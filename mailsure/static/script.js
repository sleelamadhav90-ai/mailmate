/**
 * MailSure — Email Deliverability Checker
 * Frontend Vanilla JavaScript Application
 * CivicPulse Design Inspired
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
        'contact@nasa.gov'
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
        return text.split(/[\r\n,;\s]+/).map(e => e.strip ? e.strip() : e.trim()).filter(Boolean);
    }

    function updateCounter() {
        const emails = extractEmails(emailInput.value);
        extractedCount.textContent = emails.length;
        if (emails.length > 100) {
            extractedCount.classList.add('text-[#C44747]', 'font-bold');
        } else {
            extractedCount.classList.remove('text-[#C44747]', 'font-bold');
        }
    }

    emailInput.addEventListener('input', updateCounter);

    emailInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCheck();
        }
    });

    loadSampleBtn.addEventListener('click', () => {
        emailInput.value = SAMPLE_EMAILS;
        updateCounter();
        hideError();
    });

    clearBtn.addEventListener('click', () => {
        emailInput.value = '';
        updateCounter();
        hideError();
        resultsSection.classList.add('hidden');
        currentResults = [];
    });

    function showError(msg) {
        errorMessage.textContent = msg;
        errorBanner.classList.remove('hidden');
    }

    function hideError() {
        errorBanner.classList.add('hidden');
    }

    async function runCheck() {
        hideError();
        const rawText = emailInput.value.trim();
        const emails = extractEmails(rawText);

        if (emails.length === 0) {
            showError('Please enter at least one email address to check.');
            return;
        }

        if (emails.length > 100) {
            showError(`Batch size limit exceeded. You entered ${emails.length} emails, but the maximum allowed per request is 100.`);
            return;
        }

        loadingState.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        checkBtn.disabled = true;

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
            resultsSection.classList.remove('hidden');
            
            if (window.lucide) {
                lucide.createIcons();
            }

        } catch (err) {
            showError(err.message || 'Failed to connect to verification server.');
        } finally {
            loadingState.classList.add('hidden');
            checkBtn.disabled = false;
        }
    }

    checkBtn.addEventListener('click', runCheck);

    function updateSummaryKPIs(summary) {
        statTotal.textContent = summary.total || currentResults.length;
        statDelivered.textContent = summary.likely_delivered || 0;
        statBounce.textContent = summary.likely_to_bounce || 0;
        statUnknown.textContent = summary.unknown || 0;

        countAll.textContent = summary.total || currentResults.length;
        countDelivered.textContent = summary.likely_delivered || 0;
        countBounce.textContent = summary.likely_to_bounce || 0;
        countUnknown.textContent = summary.unknown || 0;
    }

    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.getAttribute('data-filter');
            renderTable();
        });
    });

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderTable();
    });

    function renderTable() {
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
            noResultsState.classList.remove('hidden');
            return;
        } else {
            noResultsState.classList.add('hidden');
        }

        filtered.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-[#F7F9FC]/80 transition-colors border-b border-[#E3E9F2]';

            let statusBadgeHtml = '';
            if (item.status === 'Likely Delivered') {
                statusBadgeHtml = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F4EA] text-[#25855A] border border-[#25855A]/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#25855A]"></span>
                        <span>Likely Delivered</span>
                    </span>
                `;
            } else if (item.status === 'Likely to Bounce') {
                statusBadgeHtml = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#C44747] border border-[#C44747]/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#C44747]"></span>
                        <span>Likely to Bounce</span>
                    </span>
                `;
            } else {
                statusBadgeHtml = `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFFBEB] text-[#A66B12] border border-[#A66B12]/20">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#A66B12]"></span>
                        <span>Unknown</span>
                    </span>
                `;
            }

            const c = item.checks_performed || {};
            const checkTags = [];
            
            checkTags.push(c.syntax_valid 
                ? `<span class="px-2 py-0.5 rounded bg-[#F7F9FC] text-[#243247] font-mono text-[11px] border border-[#E3E9F2]">Syntax: Valid</span>`
                : `<span class="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px] border border-[#C44747]/20">Syntax: Invalid</span>`
            );

            if (c.domain_exists) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#F7F9FC] text-[#243247] font-mono text-[11px] border border-[#E3E9F2]">DNS: Resolves</span>`);
            } else {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px] border border-[#C44747]/20">DNS: NXDOMAIN</span>`);
            }

            if (c.mx_records_found) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#E6F4EA] text-[#25855A] font-mono text-[11px] border border-[#25855A]/20">MX: Present</span>`);
            } else if (c.is_null_mx) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px]">MX: Null MX</span>`);
            } else if (c.has_fallback_a) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FFFBEB] text-[#A66B12] font-mono text-[11px]">MX: Fallback A</span>`);
            } else {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px]">MX: None</span>`);
            }

            if (c.disposable_domain) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px] font-semibold">Disposable</span>`);
            }

            if (c.role_account) {
                checkTags.push(`<span class="px-2 py-0.5 rounded bg-[#EAF2FF] text-[#3478D4] font-mono text-[11px]">Role Address</span>`);
            }

            tr.innerHTML = `
                <td class="py-3 px-4 font-mono text-[#68758A] text-center">${index + 1}</td>
                <td class="py-3 px-4 font-mono font-medium text-[#243247]">${escapeHtml(item.email)}</td>
                <td class="py-3 px-4">${statusBadgeHtml}</td>
                <td class="py-3 px-4 text-[#243247] text-xs leading-relaxed">${escapeHtml(item.reason)}</td>
                <td class="py-3 px-4">
                    <div class="flex flex-wrap gap-1">${checkTags.join('')}</div>
                </td>
                <td class="py-3 px-4 text-right">
                    <button type="button" class="copy-btn px-2.5 py-1 bg-[#F7F9FC] hover:bg-[#EAF2FF] text-[#68758A] hover:text-[#243247] border border-[#E3E9F2] rounded text-xs transition-colors inline-flex items-center gap-1" data-email="${escapeHtml(item.email)}">
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                        <span>Copy</span>
                    </button>
                </td>
            `;

            resultsTableBody.appendChild(tr);
        });

        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emailToCopy = btn.getAttribute('data-email');
                navigator.clipboard.writeText(emailToCopy).then(() => {
                    const span = btn.querySelector('span');
                    const origText = span.textContent;
                    span.textContent = 'Copied!';
                    setTimeout(() => { span.textContent = origText; }, 1500);
                });
            });
        });

        if (window.lucide) {
            lucide.createIcons();
        }
    }

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
        link.setAttribute('download', `mailsure_report_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

});
