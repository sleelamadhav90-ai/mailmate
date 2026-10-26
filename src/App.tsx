import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Search, 
  Download, 
  Trash2, 
  Sparkles, 
  Mail, 
  ShieldCheck, 
  Info, 
  Copy, 
  Check, 
  Loader2, 
  ChevronRight, 
  X,
  AlertCircle
} from 'lucide-react';

interface CheckPerformed {
  syntax_valid: boolean;
  domain_exists: boolean;
  mx_records_found: boolean;
  mx_hosts?: string[];
  has_fallback_a?: boolean;
  is_null_mx?: boolean;
  disposable_domain: boolean;
  role_account: boolean;
  spf_record?: boolean;
  dmarc_record?: boolean;
}

interface EmailResult {
  email: string;
  domain: string;
  status: 'Likely Delivered' | 'Likely to Bounce' | 'Unknown';
  reason: string;
  checks_performed: CheckPerformed;
  mailbox_verified: boolean;
}

interface SummaryStats {
  total: number;
  likely_delivered: number;
  likely_to_bounce: number;
  unknown: number;
}

const SAMPLE_BATCH = [
  'alex@example.com',
  'hello@example.org',
  'pilot@shieldnex.com',
  'invalid..format@domain.com',
  'missing-at-sign.com',
  'test@definitely-non-existent-domain-9988.org',
  'user@mailinator.com',
  'contact@nasa.gov'
].join('\n');

export default function App() {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<EmailResult[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'Likely Delivered' | 'Likely to Bounce' | 'Unknown'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [inspectItem, setInspectItem] = useState<EmailResult | null>(null);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);

  // Extract non-empty email tokens
  const extractedEmails = useMemo(() => {
    if (!inputText.trim()) return [];
    return inputText.split(/[\r\n,;\s]+/).map(s => s.trim()).filter(Boolean);
  }, [inputText]);

  // Load sample on mount if empty
  useEffect(() => {
    if (!inputText) {
      setInputText(SAMPLE_BATCH);
    }
  }, []);

  const handleRunCheck = async () => {
    setErrorMsg(null);
    if (extractedEmails.length === 0) {
      setErrorMsg('Please enter at least one email address to check.');
      return;
    }
    if (extractedEmails.length > 100) {
      setErrorMsg(`Batch size limit exceeded. You entered ${extractedEmails.length} emails, but the maximum allowed limit is 100 per request.`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: inputText })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server returned error status ${response.status}`);
      }

      setResults(data.results || []);
      setSummary(data.summary || {
        total: data.results?.length || 0,
        likely_delivered: data.results?.filter((r: EmailResult) => r.status === 'Likely Delivered').length || 0,
        likely_to_bounce: data.results?.filter((r: EmailResult) => r.status === 'Likely to Bounce').length || 0,
        unknown: data.results?.filter((r: EmailResult) => r.status === 'Unknown').length || 0
      });
      setActiveTab('all');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to connect to verification server. Please verify your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setResults([]);
    setSummary(null);
    setErrorMsg(null);
    setSearchQuery('');
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const filteredResults = useMemo(() => {
    return results.filter(item => {
      if (activeTab !== 'all' && item.status !== activeTab) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return item.email.toLowerCase().includes(q) || 
               item.domain.toLowerCase().includes(q) || 
               item.reason.toLowerCase().includes(q);
      }
      return true;
    });
  }, [results, activeTab, searchQuery]);

  const handleExportCsv = () => {
    if (results.length === 0) return;

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

    const rows = results.map(item => {
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mailsure_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#F7F9FC] text-[#243247] min-h-screen font-sans flex flex-col antialiased">
      
      {/* CivicPulse Light Top Bar Header */}
      <header className="bg-white border-b border-[#E3E9F2] px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EAF2FF] border border-[#3478D4]/20 flex items-center justify-center text-[#3478D4]">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-[#243247]">MailSure</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#EAF2FF] text-[#3478D4] font-medium">
                  Deliverability Checker
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-[#68758A]">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E6F4EA] text-[#25855A] font-medium text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy-first checks</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Editorial CivicPulse Hero */}
        <section className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#3478D4] bg-[#EAF2FF] px-2.5 py-1 rounded-md">
            <span>Responsible Email Validation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#243247] tracking-tight">
            Know which emails need a closer look.
          </h1>
          <p className="text-[#68758A] text-sm sm:text-base max-w-2xl leading-relaxed">
            Check email formatting and domain mail records in one place. Get clear results, understand potential delivery issues, and export your findings.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-xs text-[#68758A]">
            <Info className="w-3.5 h-3.5 text-[#3478D4]" />
            <span>No emails sent. No mailbox access required.</span>
          </div>
        </section>

        {/* Main Checker Interface Card */}
        <section className="bg-white rounded-xl border border-[#E3E9F2] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label htmlFor="emailInput" className="text-sm font-semibold text-[#243247] block">
                Enter email addresses
              </label>
              <p className="text-xs text-[#68758A]">Paste addresses separated by newlines, commas, or semicolons.</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => setInputText(SAMPLE_BATCH)}
                className="px-3 py-1.5 text-xs font-medium bg-[#F7F9FC] text-[#243247] hover:bg-[#EAF2FF] hover:text-[#3478D4] rounded-lg transition-colors flex items-center gap-1.5 border border-[#E3E9F2] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#3478D4]" />
                <span>Load sample list</span>
              </button>
              <button 
                type="button" 
                onClick={handleClear}
                className="px-3 py-1.5 text-xs font-medium bg-[#F7F9FC] text-[#243247] hover:bg-rose-50 hover:text-[#C44747] rounded-lg transition-colors flex items-center gap-1.5 border border-[#E3E9F2] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <textarea 
              id="emailInput"
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="alex@example.com&#10;hello@example.org&#10;user@domain.com"
              className="w-full bg-[#F7F9FC] border border-[#E3E9F2] rounded-lg p-4 text-sm font-mono text-[#243247] placeholder-[#68758A]/60 focus:outline-none focus:ring-2 focus:ring-[#3478D4] focus:border-transparent transition-all shadow-xs resize-y"
            />
            <div className="absolute bottom-3 right-4 text-xs font-mono text-[#68758A] pointer-events-none">
              <span className={extractedEmails.length > 100 ? 'text-[#C44747] font-bold' : ''}>
                {extractedEmails.length}
              </span> / 100 addresses
            </div>
          </div>

          {errorMsg && (
            <div className="bg-[#FEF2F2] border border-[#FEE2E2] rounded-lg p-3.5 text-[#C44747] text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#C44747]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <p className="text-xs text-[#68758A] max-w-lg">
              Note: DNS and syntax checks confirm domain routing capabilities, but cannot guarantee individual mailbox presence.
            </p>
            <button 
              type="button" 
              onClick={handleRunCheck}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#3478D4] hover:bg-[#2B66B8] text-white font-medium text-sm rounded-lg transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking addresses...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Check emails</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Results Summary and Table */}
        {summary && (
          <section className="space-y-6">
            
            {/* Compact Summary Cards Grid (4 Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E3E9F2] rounded-xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs text-[#68758A] font-medium block">Total checked</span>
                  <span className="text-2xl font-bold font-mono text-[#243247]">{summary.total}</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#F7F9FC] flex items-center justify-center text-[#68758A]">
                  <Mail className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white border border-[#25855A]/20 rounded-xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs text-[#25855A] font-semibold block">Likely Delivered</span>
                  <span className="text-2xl font-bold font-mono text-[#25855A]">{summary.likely_delivered}</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#E6F4EA] flex items-center justify-center text-[#25855A]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white border border-[#C44747]/20 rounded-xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs text-[#C44747] font-semibold block">Likely to Bounce</span>
                  <span className="text-2xl font-bold font-mono text-[#C44747]">{summary.likely_to_bounce}</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#FEF2F2] flex items-center justify-center text-[#C44747]">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-white border border-[#A66B12]/20 rounded-xl p-4 flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs text-[#A66B12] font-semibold block">Unknown</span>
                  <span className="text-2xl font-bold font-mono text-[#A66B12]">{summary.unknown}</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] flex items-center justify-center text-[#A66B12]">
                  <HelpCircle className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Filter & Toolbar */}
            <div className="bg-white rounded-xl border border-[#E3E9F2] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              
              {/* Segmented Filter Buttons */}
              <div className="flex items-center gap-1 bg-[#F7F9FC] p-1 rounded-lg border border-[#E3E9F2] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'all' 
                      ? 'bg-white text-[#243247] shadow-xs border border-[#E3E9F2]' 
                      : 'text-[#68758A] hover:text-[#243247]'
                  }`}
                >
                  All ({summary.total})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Likely Delivered')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'Likely Delivered' 
                      ? 'bg-white text-[#25855A] shadow-xs border border-[#E3E9F2]' 
                      : 'text-[#68758A] hover:text-[#243247]'
                  }`}
                >
                  Likely Delivered ({summary.likely_delivered})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Likely to Bounce')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'Likely to Bounce' 
                      ? 'bg-white text-[#C44747] shadow-xs border border-[#E3E9F2]' 
                      : 'text-[#68758A] hover:text-[#243247]'
                  }`}
                >
                  Likely to Bounce ({summary.likely_to_bounce})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Unknown')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'Unknown' 
                      ? 'bg-white text-[#A66B12] shadow-xs border border-[#E3E9F2]' 
                      : 'text-[#68758A] hover:text-[#243247]'
                  }`}
                >
                  Unknown ({summary.unknown})
                </button>
              </div>

              {/* Search & Export */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 text-[#68758A] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search address or domain..." 
                    className="w-full bg-[#F7F9FC] border border-[#E3E9F2] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#243247] placeholder-[#68758A]/60 focus:outline-none focus:ring-1 focus:ring-[#3478D4]"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleExportCsv}
                  className="px-3.5 py-1.5 bg-[#F7F9FC] hover:bg-[#EAF2FF] text-[#243247] border border-[#E3E9F2] font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#3478D4]" />
                  <span>Export CSV</span>
                </button>
              </div>

            </div>

            {/* Results Table */}
            <div className="bg-white rounded-xl border border-[#E3E9F2] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#E3E9F2] text-[#68758A] font-medium">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4 min-w-[200px]">Email Address</th>
                      <th className="py-3 px-4 min-w-[150px]">Status</th>
                      <th className="py-3 px-4 min-w-[280px]">Reason & Details</th>
                      <th className="py-3 px-4 min-w-[220px]">Checks Performed</th>
                      <th className="py-3 px-4 w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E9F2]">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#68758A] text-xs">
                          No email addresses match your selected filter or search query.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((item, idx) => {
                        const c = item.checks_performed || {};
                        return (
                          <tr key={idx} className="hover:bg-[#F7F9FC]/80 transition-colors">
                            <td className="py-3 px-4 font-mono text-[#68758A] text-center">{idx + 1}</td>
                            <td className="py-3 px-4 font-mono font-medium text-[#243247]">{item.email}</td>
                            <td className="py-3 px-4">
                              {item.status === 'Likely Delivered' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E6F4EA] text-[#25855A] border border-[#25855A]/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#25855A]"></span>
                                  <span>Likely Delivered</span>
                                </span>
                              )}
                              {item.status === 'Likely to Bounce' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FEF2F2] text-[#C44747] border border-[#C44747]/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#C44747]"></span>
                                  <span>Likely to Bounce</span>
                                </span>
                              )}
                              {item.status === 'Unknown' && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#FFFBEB] text-[#A66B12] border border-[#A66B12]/20">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#A66B12]"></span>
                                  <span>Unknown</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#243247] text-xs leading-relaxed">{item.reason}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1">
                                {c.syntax_valid ? (
                                  <span className="px-2 py-0.5 rounded bg-[#F7F9FC] text-[#243247] font-mono text-[11px] border border-[#E3E9F2]">Syntax: Valid</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px] border border-[#C44747]/20">Syntax: Invalid</span>
                                )}

                                {c.domain_exists ? (
                                  <span className="px-2 py-0.5 rounded bg-[#F7F9FC] text-[#243247] font-mono text-[11px] border border-[#E3E9F2]">DNS: Resolves</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px] border border-[#C44747]/20">DNS: NXDOMAIN</span>
                                )}

                                {c.mx_records_found ? (
                                  <span className="px-2 py-0.5 rounded bg-[#E6F4EA] text-[#25855A] font-mono text-[11px] border border-[#25855A]/20">MX: Present</span>
                                ) : c.is_null_mx ? (
                                  <span className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px]">MX: Null MX</span>
                                ) : c.has_fallback_a ? (
                                  <span className="px-2 py-0.5 rounded bg-[#FFFBEB] text-[#A66B12] font-mono text-[11px]">MX: Fallback A</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px]">MX: None</span>
                                )}

                                {c.disposable_domain && (
                                  <span className="px-2 py-0.5 rounded bg-[#FEF2F2] text-[#C44747] font-mono text-[11px] font-semibold">Disposable</span>
                                )}

                                {c.role_account && (
                                  <span className="px-2 py-0.5 rounded bg-[#EAF2FF] text-[#3478D4] font-mono text-[11px]">Role Address</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  type="button" 
                                  onClick={() => setInspectItem(item)}
                                  className="px-2.5 py-1 bg-[#F7F9FC] hover:bg-[#EAF2FF] text-[#3478D4] rounded text-xs transition-colors flex items-center gap-1 cursor-pointer border border-[#E3E9F2]"
                                >
                                  <span>Details</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => handleCopy(item.email, idx)}
                                  className="p-1.5 bg-[#F7F9FC] hover:bg-[#EAF2FF] text-[#68758A] hover:text-[#243247] rounded text-xs transition-colors cursor-pointer border border-[#E3E9F2]"
                                  title="Copy address"
                                >
                                  {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-[#25855A]" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

      </main>

      {/* Inspect Item Modal */}
      {inspectItem && (
        <div className="fixed inset-0 bg-[#243247]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3E9F2] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl relative">
            <button 
              onClick={() => setInspectItem(null)}
              className="absolute top-4 right-4 text-[#68758A] hover:text-[#243247] p-1 rounded-lg hover:bg-[#F7F9FC] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-mono text-[#3478D4] uppercase font-semibold">Inspection Record</span>
              <h3 className="text-lg font-mono font-bold text-[#243247] break-all">{inspectItem.email}</h3>
              <p className="text-xs text-[#68758A] font-mono">Domain: {inspectItem.domain}</p>
            </div>

            <div className="space-y-2.5 bg-[#F7F9FC] rounded-xl p-4 border border-[#E3E9F2] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#68758A]">Classification:</span>
                <span className="font-semibold text-[#243247]">{inspectItem.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68758A]">Mailbox Verified:</span>
                <span className="font-mono text-[#A66B12]">False (Domain Estimate)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68758A]">Role Address:</span>
                <span className="font-mono text-[#243247]">{inspectItem.checks_performed.role_account ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#68758A]">Disposable Service:</span>
                <span className="font-mono text-[#243247]">{inspectItem.checks_performed.disposable_domain ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {inspectItem.checks_performed.mx_hosts && inspectItem.checks_performed.mx_hosts.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#243247]">Mail Exchanger (MX) Records:</span>
                <div className="bg-[#F7F9FC] rounded-lg p-3 border border-[#E3E9F2] space-y-1">
                  {inspectItem.checks_performed.mx_hosts.map((mx, idx) => (
                    <div key={idx} className="font-mono text-xs text-[#25855A] flex items-center gap-2">
                      <span className="text-[#68758A]">[{idx + 1}]</span>
                      <span>{mx}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#243247]">Reasoning Assessment:</span>
              <p className="text-xs text-[#243247] leading-relaxed bg-[#F7F9FC] p-3 rounded-lg border border-[#E3E9F2]">
                {inspectItem.reason}
              </p>
            </div>

            <button 
              type="button" 
              onClick={() => setInspectItem(null)}
              className="w-full py-2 bg-[#F7F9FC] hover:bg-[#EAF2FF] text-[#243247] text-xs font-medium rounded-lg transition-colors cursor-pointer border border-[#E3E9F2]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Light Footer */}
      <footer className="border-t border-[#E3E9F2] bg-white px-6 py-4 text-xs text-[#68758A] mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-[#243247]">MailSure</span> — Built for responsible email validation.
          </div>
          <div className="text-center sm:text-right text-[11px] text-[#68758A]">
            DNS and syntax checks confirm server routing configuration, but cannot guarantee individual mailbox delivery.
          </div>
        </div>
      </footer>

    </div>
  );
}
