/**
 * MailMate — Email Deliverability Checker
 * Frontend Vanilla JavaScript Application
 * Classic Ivory, Charcoal & Burnt Orange Palette
 */

document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('emailInput');
    const extractedCount = document.getElementById('extractedCount');
    const checkBtn = document.getElementById('checkBtn');
    const clearBtn = document.getElementById('clearBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');
    const loadingState = document.getElementById('loadingState');
    const resultsSection = document.getElementById('resultsSection');
    const errorBanner = document.getElementById('errorBanner');
    const errorMessage = document.getElementById('errorMessage');
    
    const statTotal = document.getElementById('statTotal');
    const statDelivered = document.getElementById('statDelivered');
    const statBounce = document.getElementById('statBounce');
    const statUnknown = document.getElementById('statUnknown');
    
    const filterTabs = document.querySelectorAll('.filter-tab');
    const countAll = document.getElementById('countAll');
    const countDelivered = document.getElementById('countDelivered');
    const countBounce = document.getElementById('countBounce');
    const countUnknown = document.getElementById('countUnknown');
    const searchInput = document.getElementById('searchInput');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const noResultsState = document.getElementById('noResultsState');

    let currentResults = [];
    let activeFilter = 'all';
    let searchQuery = '';

    const SAMPLE_EMAILS = [
        'alex@example.com',
        'hello@example.org',
        'pilot@shieldnex.com',
        'invalid..format@domain.com',
        'missing-at-sign.com',
        'test@definitely-non-existent-domain-9988.org',
        'user@mailinator.com',
        'contact@nasa.gov',
        'sleelamadhav90@gmail.com'
    ].join('\n');

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function extractEmails(text) {
        if (!text) return [];
        return text.split(/[\r\n,;\s]+/).map(e => e.trim()).filter(Boolean);
    }

    function updateCounter() {
        if (!emailInput || !extractedCount) return;
        const emails = extractEmails(emailInput.value);
        extractedCount.textContent = emails.length;
        if (emails.length > 100) {
            extractedCount.classList.add('text-[#B64A42]', 'font-bold');
        } else {
            extractedCount.classList.remove('text-[#B64A42]', 'font-bold');
        }
    }

    if (emailInput) {
        emailInput.addEventListener('input', updateCounter);

        emailInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                runCheck();
            }
        });
    }

    if (loadSampleBtn) {
        loadSampleBtn.addEventListener('click', () => {
            if (emailInput) {
                emailInput.value = SAMPLE_EMAILS;
                updateCounter();
            }
            hideError();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (emailInput) emailInput.value = '';
            updateCounter();
            hideError();
            if (resultsSection) resultsSection.classList.add('hidden');
            currentResults = [];
        });
    }

    function showError(msg) {
        if (errorMessage) errorMessage.textContent = msg;
        if (errorBanner) errorBanner.classList.remove('hidden');
    }

    function hideError() {
        if (errorBanner) errorBanner.classList.add('hidden');
    }

    async function runCheck() {
        hideError();
        const rawText = emailInput ? emailInput.value.trim() : '';
        const emails = extractEmails(rawText);

        if (emails.length === 0) {
            showError('Please enter at least one email address to check.');
            return;
        }

        if (emails.length > 100) {
            showError(`Batch size limit exceeded. You entered ${emails.length} emails, but the maximum allowed per request is 100.`);
            return;
        }

        if (loadingState) loadingState.classList.remove('hidden');
        if (resultsSection) resultsSection.classList.add('hidden');
        if (checkBtn) checkBtn.disabled = true;

        try {
            const response = await fetch('/api/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ emails: rawText })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Server returned error status ${response.status}`);
            }

            currentResults = data.results || [];
            updateSummaryKPIs(data.summary || {});
            renderTable();
            if (resultsSection) resultsSection.classList.remove('hidden');
            
            if (window.lucide) {
                lucide.createIcons();
            }

        } catch (err) {
            showError(err.message || 'Failed to connect to verification server.');
        } finally {
            if (loadingState) loadingState.classList.add('hidden');
            if (checkBtn) checkBtn.disabled = false;
        }
    }

    if (checkBtn) {
        checkBtn.addEventListener('click', runCheck);
    }

    function updateSummaryKPIs(summary) {
        const delivCount = summary.likely_deliverable ?? summary.likely_delivered ?? 0;
        if (statTotal) statTotal.textContent = summary.total || currentResults.length;
        if (statDelivered) statDelivered.textContent = delivCount;
        if (statBounce) statBounce.textContent = summary.likely_to_bounce || 0;
        if (statUnknown) statUnknown.textContent = summary.unknown || 0;

        if (countAll) countAll.textContent = summary.total || currentResults.length;
        if (countDelivered) countDelivered.textContent = delivCount;
        if (countBounce) countBounce.textContent = summary.likely_to_bounce || 0;
        if (countUnknown) countUnknown.textContent = summary.unknown || 0;
    }

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.getAttribute('data-filter');
            renderTable();
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderTable();
        });
    }

    function renderTable() {
        if (!resultsTableBody) return;
        resultsTableBody.innerHTML = '';
        
        let filtered = currentResults.filter(item => {
            if (activeFilter !== 'all' && item.status !== activeFilter) {
                return false;
            }
            if (searchQuery) {
                const matchEmail = item.email.toLowerCase().includes(searchQuery);
                const matchDomain = (item.domain || '').toLowerCase().includes(searchQuery);
                const matchReason = (item.reason || '').toLowerCase().includes(searchQuery);
                return matchEmail || matchDomain || matchReason;
            }
            return true;
        });

        if (filtered.length === 0) {
            if (noResultsState) noResultsState.classList.remove('hidden');
            return;
        } else {
            if (noResultsState) noResultsState.classList.add('hidden');
        }

        filtered.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#FAF9F6] transition-colors border-b border-[#E5E1DB]';

            let statusBadgeHtml = '';
            if (item.status === 'Likely Deliverable' || item.status === 'Likely Delivered') {
                statusBadgeHtml = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#EAF4EE] text-[#367553] border border-[#367553]/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#367553]"></span>
                        <span>Likely Deliverable</span>
                    </span>
                `;
            } else if (item.status === 'Likely to Bounce') {
                statusBadgeHtml = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#FBF0EF] text-[#B64A42] border border-[#B64A42]/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#B64A42]"></span>
                        <span>Likely to Bounce</span>
                    </span>
                `;
            } else if (item.status === 'Invalid Format') {
                statusBadgeHtml = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#F5F4F0] text-[#686868] border border-[#E5E1DB]">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#686868]"></span>
                        <span>Invalid Format</span>
                    </span>
                `;
            } else {
                statusBadgeHtml = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#F8EEE6] text-[#A66D24] border border-[#A66D24]/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#A66D24]"></span>
                        <span>Unknown</span>
                    </span>
                `;
            }

            const c = item.checks_performed || {};
            const checkTags = [];
            
            checkTags.push(c.syntax_valid 
                ? `<span class="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#252525] font-sans font-medium text-[11px] border border-[#E5E1DB]">Syntax: Valid</span>`
                : `<span class="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] font-sans font-medium text-[11px] border border-[#B64A42]/20">Syntax: Invalid</span>`
            );

            if (c.dns_status === 'Skipped (Invalid Syntax)' || !c.syntax_valid) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#686868] font-sans font-medium text-[11px] border border-[#E5E1DB]">DNS: Skipped</span>`);
            } else if (c.dns_status === 'TIMEOUT') {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] font-sans font-medium text-[11px] border border-[#A66D24]/20">DNS: Timeout</span>`);
            } else if (c.dns_status === 'DNS_SERVER_ERROR') {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] font-sans font-medium text-[11px] border border-[#A66D24]/20">DNS: SERVFAIL</span>`);
            } else if (c.domain_exists) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#252525] font-sans font-medium text-[11px] border border-[#E5E1DB]">DNS: Resolved</span>`);
            } else {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] font-sans font-medium text-[11px] border border-[#B64A42]/20">DNS: NXDOMAIN</span>`);
            }

            if (!c.syntax_valid) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#686868] font-sans font-medium text-[11px] border border-[#E5E1DB]">MX: N/A</span>`);
            } else if (c.mx_records_found) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#EAF4EE] text-[#367553] font-sans font-medium text-[11px] border border-[#367553]/20">MX: Present</span>`);
            } else if (c.is_null_mx) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] font-sans font-medium text-[11px] border border-[#B64A42]/20">MX: Null MX</span>`);
            } else if (c.has_fallback_a) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] font-sans font-medium text-[11px] border border-[#A66D24]/20">MX: Fallback A</span>`);
            } else if (c.domain_exists === false) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] font-sans font-medium text-[11px] border border-[#B64A42]/20">MX: None</span>`);
            } else {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] font-sans font-medium text-[11px] border border-[#A66D24]/20">MX: Inconclusive</span>`);
            }

            if (c.disposable_domain) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] font-sans font-medium text-[11px] border border-[#B64A42]/20">Disposable</span>`);
            }

            if (c.role_account) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#C66A32] font-sans font-medium text-[11px] border border-[#E5E1DB]">Role Address</span>`);
            }

            tr.innerHTML = `
                <td class="py-3.5 px-4 font-mono text-[#686868] text-center text-xs">${index + 1}</td>
                <td class="py-3.5 px-4 font-mono font-medium text-[#252525] text-xs break-all">${escapeHtml(item.email)}</td>
                <td class="py-3.5 px-4 font-sans">${statusBadgeHtml}</td>
                <td class="py-3.5 px-4 text-[#252525] text-xs leading-relaxed font-sans">${escapeHtml(item.reason)}</td>
                <td class="py-3.5 px-4 font-sans">
                    <div class="flex flex-wrap gap-1.5">${checkTags.join('')}</div>
                </td>
                <td class="py-3.5 px-4 text-right font-sans">
                    <button type="button" class="copy-btn px-2.5 py-1 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#252525] border border-[#E5E1DB] rounded text-xs font-sans font-medium transition-colors inline-flex items-center gap-1 cursor-pointer" data-email="${escapeHtml(item.email)}">
                        <i data-lucide="copy" class="w-3.5 h-3.5 text-[#686868]"></i>
                        <span>Copy</span>
                    </button>
                </td>
            `;

            resultsTableBody.appendChild(tr);
        });

        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emailToCopy = btn.getAttribute('data-email');
                if (emailToCopy) {
                    navigator.clipboard.writeText(emailToCopy).then(() => {
                        const span = btn.querySelector('span');
                        if (span) {
                            const origText = span.textContent;
                            span.textContent = 'Copied!';
                            setTimeout(() => { span.textContent = origText; }, 1500);
                        }
                    });
                }
            });
        });

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    if (exportCsvBtn) {
        exportCsvBtn.addEventListener('click', () => {
            if (currentResults.length === 0) return;

            const headers = [
                'Email Address',
                'Status',
                'Reason',
                'Domain',
                'Syntax Valid',
                'Domain Exists',
                'MX Records Found',
                'MX Hosts',
                'Disposable Domain',
                'Role Account',
                'Mailbox Verified',
                'Checked Timestamp'
            ];

            const rows = currentResults.map(item => {
                const c = item.checks_performed || {};
                const mxHostsStr = (c.mx_hosts || []).join('; ');
                return [
                    `"${(item.email || '').replace(/"/g, '""')}"`,
                    `"${(item.status || '').replace(/"/g, '""')}"`,
                    `"${(item.reason || '').replace(/"/g, '""')}"`,
                    `"${(item.domain || '').replace(/"/g, '""')}"`,
                    c.syntax_valid ? 'True' : 'False',
                    c.domain_exists ? 'True' : 'False',
                    c.mx_records_found ? 'True' : 'False',
                    `"${mxHostsStr.replace(/"/g, '""')}"`,
                    c.disposable_domain ? 'True' : 'False',
                    c.role_account ? 'True' : 'False',
                    item.mailbox_verified ? 'True' : 'False',
                    `"${new Date().toISOString()}"`
                ];
            });

            const csvContent = 'data:text/csv;charset=utf-8,' 
                + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `mailmate_report_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

});
