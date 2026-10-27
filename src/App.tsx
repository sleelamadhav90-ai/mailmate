import React, { useState, useMemo } from 'react';
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
  AlertCircle,
  AlertTriangle
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
  dns_status?: string;
}

interface EmailResult {
  email: string;
  domain: string;
  status: 'Likely Deliverable' | 'Likely to Bounce' | 'Unknown' | 'Invalid Format';
  reason: string;
  checks_performed: CheckPerformed;
  mailbox_verified: boolean;
}

interface SummaryStats {
  total: number;
  likely_deliverable: number;
  likely_to_bounce: number;
  unknown: number;
  invalid_format: number;
}

const SAMPLE_BATCH = [
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

export default function App() {
  // Input starts completely empty (no pre-populated sample emails)
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<EmailResult[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'Likely Deliverable' | 'Likely to Bounce' | 'Unknown' | 'Invalid Format'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [inspectItem, setInspectItem] = useState<EmailResult | null>(null);

  // Extract non-empty email tokens
  const extractedEmails = useMemo(() => {
    if (!inputText.trim()) return [];
    return inputText.split(/[\r\n,;\s]+/).map(s => s.trim()).filter(Boolean);
  }, [inputText]);

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
      setSummary({
        total: data.summary?.total ?? data.results?.length ?? 0,
        likely_deliverable: data.summary?.likely_deliverable ?? data.summary?.likely_delivered ?? data.results?.filter((r: EmailResult) => r.status === 'Likely Deliverable').length ?? 0,
        likely_to_bounce: data.summary?.likely_to_bounce ?? data.results?.filter((r: EmailResult) => r.status === 'Likely to Bounce').length ?? 0,
        unknown: data.summary?.unknown ?? data.results?.filter((r: EmailResult) => r.status === 'Unknown').length ?? 0,
        invalid_format: data.summary?.invalid_format ?? data.results?.filter((r: EmailResult) => r.status === 'Invalid Format').length ?? 0
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
    link.setAttribute('download', `mailmate_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderStatusBadge = (status: EmailResult['status']) => {
    switch (status) {
      case 'Likely Deliverable':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#EAF4EE] text-[#367553] border border-[#367553]/20 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#367553]"></span>
            <span>Likely Deliverable</span>
          </span>
        );
      case 'Likely to Bounce':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#FBF0EF] text-[#B64A42] border border-[#B64A42]/20 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B64A42]"></span>
            <span>Likely to Bounce</span>
          </span>
        );
      case 'Unknown':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#F8EEE6] text-[#A66D24] border border-[#A66D24]/20 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A66D24]"></span>
            <span>Unknown</span>
          </span>
        );
      case 'Invalid Format':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-[#F5F4F0] text-[#686868] border border-[#E5E1DB] shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#686868]"></span>
            <span>Invalid Format</span>
          </span>
        );
    }
  };

  const renderCheckBadges = (c: CheckPerformed) => {
    return (
      <div className="flex flex-wrap gap-1.5">
        {c.syntax_valid ? (
          <span className="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#252525] text-[11px] font-sans font-medium border border-[#E5E1DB]">Syntax: Valid</span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] text-[11px] font-sans font-medium border border-[#B64A42]/20">Syntax: Invalid</span>
        )}

        {c.dns_status === 'Skipped (Invalid Syntax)' || !c.syntax_valid ? (
          <span className="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#686868] text-[11px] font-sans font-medium border border-[#E5E1DB]">DNS: Skipped</span>
        ) : c.dns_status === 'TIMEOUT' ? (
          <span className="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] text-[11px] font-sans font-medium border border-[#A66D24]/20">DNS: Timeout</span>
        ) : c.dns_status === 'DNS_SERVER_ERROR' ? (
          <span className="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] text-[11px] font-sans font-medium border border-[#A66D24]/20">DNS: SERVFAIL</span>
        ) : c.domain_exists ? (
          <span className="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#252525] text-[11px] font-sans font-medium border border-[#E5E1DB]">DNS: Resolved</span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] text-[11px] font-sans font-medium border border-[#B64A42]/20">DNS: NXDOMAIN</span>
        )}

        {!c.syntax_valid ? (
          <span className="px-2 py-0.5 rounded bg-[#F5F4F0] text-[#686868] text-[11px] font-sans font-medium border border-[#E5E1DB]">MX: N/A</span>
        ) : c.mx_records_found ? (
          <span className="px-2 py-0.5 rounded bg-[#EAF4EE] text-[#367553] text-[11px] font-sans font-medium border border-[#367553]/20">MX: Present</span>
        ) : c.is_null_mx ? (
          <span className="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] text-[11px] font-sans font-medium border border-[#B64A42]/20">MX: Null MX</span>
        ) : c.has_fallback_a ? (
          <span className="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] text-[11px] font-sans font-medium border border-[#A66D24]/20">MX: Fallback A</span>
        ) : c.domain_exists === false ? (
          <span className="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] text-[11px] font-sans font-medium border border-[#B64A42]/20">MX: None</span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#A66D24] text-[11px] font-sans font-medium border border-[#A66D24]/20">MX: Inconclusive</span>
        )}

        {c.disposable_domain && (
          <span className="px-2 py-0.5 rounded bg-[#FBF0EF] text-[#B64A42] text-[11px] font-sans font-medium border border-[#B64A42]/20">Disposable</span>
        )}

        {c.role_account && (
          <span className="px-2 py-0.5 rounded bg-[#F8EEE6] text-[#C66A32] text-[11px] font-sans font-medium border border-[#E5E1DB]">Role Address</span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#F5F4F0] text-[#252525] min-h-screen font-sans flex flex-col antialiased">
      
      {/* Top Header Navigation - Clean logo without unnecessary badge */}
      <header className="bg-[#FFFFFF] border-b border-[#E5E1DB] px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#F8EEE6] border border-[#E5E1DB] flex items-center justify-center text-[#C66A32]">
              <Mail className="w-4 h-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-[#252525]">MailMate</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-[#686868]">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F4F0] text-[#686868] border border-[#E5E1DB] text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#367553]" />
              <span>Privacy-first checks</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Editorial Hero Section with DM Serif Display Headline */}
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#C66A32] bg-[#F8EEE6] border border-[#E5E1DB] px-2.5 py-1 rounded-md">
            <span>Check first. Send smarter.</span>
          </div>
          <h1 className="font-serif-display text-[34px] sm:text-[44px] md:text-[48px] leading-[1.18] text-[#252525] tracking-normal">
            Know which emails need a closer look.
          </h1>
          <p className="text-[#686868] text-sm sm:text-base max-w-2xl leading-relaxed font-normal">
            Assess a list of email addresses and understand which are likely deliverable, likely to bounce, or have an unknown status.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-xs text-[#686868]">
            <Info className="w-3.5 h-3.5 text-[#C66A32]" />
            <span>No emails sent. No mailbox access required.</span>
          </div>
        </section>

        {/* Input Section - Broad White Panel */}
        <section className="bg-[#FFFFFF] rounded-xl border border-[#E5E1DB] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[#252525] block font-sans">
                Enter email addresses
              </h2>
              <p className="text-xs text-[#686868] font-sans">Paste addresses separated by newlines, commas, or semicolons.</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => setInputText(SAMPLE_BATCH)}
                className="px-3 py-1.5 text-xs font-sans font-medium bg-[#FFFFFF] text-[#252525] hover:text-[#C66A32] hover:bg-[#F8EEE6] rounded-lg transition-colors flex items-center gap-1.5 border border-[#E5E1DB] cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C66A32]" />
                <span>Load sample list</span>
              </button>
              <button 
                type="button" 
                onClick={handleClear}
                className="px-3 py-1.5 text-xs font-sans font-medium bg-[#FFFFFF] text-[#252525] hover:text-[#B64A42] hover:bg-[#FBF0EF] rounded-lg transition-colors flex items-center gap-1.5 border border-[#E5E1DB] cursor-pointer"
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
              placeholder="Paste email addresses here, one per line..."
              className="w-full bg-[#FFFFFF] border border-[#E5E1DB] rounded-lg p-4 text-xs sm:text-sm font-mono text-[#252525] placeholder-[#686868]/50 focus:outline-none focus:ring-2 focus:ring-[#C66A32]/30 focus:border-[#C66A32] transition-all resize-y"
            />
            <div className="absolute bottom-3 right-4 text-xs font-sans text-[#686868] pointer-events-none">
              <span className={extractedEmails.length > 100 ? 'text-[#B64A42] font-semibold' : 'font-medium'}>
                {extractedEmails.length}
              </span> / 100 addresses
            </div>
          </div>

          {errorMsg && (
            <div className="bg-[#FBF0EF] border border-[#B64A42]/20 rounded-lg p-3.5 text-[#B64A42] text-xs font-sans flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#B64A42]" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <p className="text-xs text-[#686868] font-sans max-w-lg leading-relaxed">
              Note: Domain-level DNS and syntax checks confirm mail server routing configuration, but cannot guarantee individual mailbox presence.
            </p>
            <button 
              type="button" 
              onClick={handleRunCheck}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#C66A32] hover:bg-[#B35D2A] text-white font-sans font-medium text-sm rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Checking addresses...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 text-white" />
                  <span>Check emails</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Results Summary and Table */}
        {summary && (
          <section className="space-y-6 font-sans">
            
            {/* Compact Summary Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-[#FFFFFF] border border-[#E5E1DB] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#686868] font-medium block">Total checked</span>
                  <span className="text-2xl font-semibold text-[#252525]">{summary.total}</span>
                </div>
                <div className="w-8 h-8 rounded-md bg-[#F5F4F0] border border-[#E5E1DB] flex items-center justify-center text-[#686868]">
                  <Mail className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#E5E1DB] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#367553] font-semibold block">Likely Deliverable</span>
                  <span className="text-2xl font-semibold text-[#367553]">{summary.likely_deliverable}</span>
                </div>
                <div className="w-8 h-8 rounded-md bg-[#EAF4EE] border border-[#367553]/20 flex items-center justify-center text-[#367553]">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#E5E1DB] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#B64A42] font-semibold block">Likely to Bounce</span>
                  <span className="text-2xl font-semibold text-[#B64A42]">{summary.likely_to_bounce}</span>
                </div>
                <div className="w-8 h-8 rounded-md bg-[#FBF0EF] border border-[#B64A42]/20 flex items-center justify-center text-[#B64A42]">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#E5E1DB] rounded-lg p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[#A66D24] font-semibold block">Unknown</span>
                  <span className="text-2xl font-semibold text-[#A66D24]">{summary.unknown}</span>
                </div>
                <div className="w-8 h-8 rounded-md bg-[#F8EEE6] border border-[#A66D24]/20 flex items-center justify-center text-[#A66D24]">
                  <HelpCircle className="w-4 h-4" />
                </div>
              </div>

              <div className="bg-[#FFFFFF] border border-[#E5E1DB] rounded-lg p-3.5 flex items-center justify-between col-span-2 sm:col-span-1">
                <div>
                  <span className="text-xs text-[#686868] font-semibold block">Invalid Format</span>
                  <span className="text-2xl font-semibold text-[#686868]">{summary.invalid_format}</span>
                </div>
                <div className="w-8 h-8 rounded-md bg-[#F5F4F0] border border-[#E5E1DB] flex items-center justify-center text-[#686868]">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Filter & Toolbar */}
            <div className="bg-[#FFFFFF] rounded-xl border border-[#E5E1DB] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-[#F5F4F0] p-1 rounded-lg border border-[#E5E1DB] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-sans font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'all' 
                      ? 'bg-[#FFFFFF] text-[#252525] border border-[#E5E1DB] font-semibold' 
                      : 'text-[#686868] hover:text-[#252525]'
                  }`}
                >
                  All ({summary.total})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Likely Deliverable')}
                  className={`px-3 py-1.5 text-xs font-sans font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'Likely Deliverable' 
                      ? 'bg-[#FFFFFF] text-[#367553] border border-[#E5E1DB] font-semibold' 
                      : 'text-[#686868] hover:text-[#252525]'
                  }`}
                >
                  Likely Deliverable ({summary.likely_deliverable})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Likely to Bounce')}
                  className={`px-3 py-1.5 text-xs font-sans font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'Likely to Bounce' 
                      ? 'bg-[#FFFFFF] text-[#B64A42] border border-[#E5E1DB] font-semibold' 
                      : 'text-[#686868] hover:text-[#252525]'
                  }`}
                >
                  Likely to Bounce ({summary.likely_to_bounce})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Unknown')}
                  className={`px-3 py-1.5 text-xs font-sans font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'Unknown' 
                      ? 'bg-[#FFFFFF] text-[#A66D24] border border-[#E5E1DB] font-semibold' 
                      : 'text-[#686868] hover:text-[#252525]'
                  }`}
                >
                  Unknown ({summary.unknown})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('Invalid Format')}
                  className={`px-3 py-1.5 text-xs font-sans font-medium rounded-md transition-all whitespace-nowrap cursor-pointer ${
                    activeTab === 'Invalid Format' 
                      ? 'bg-[#FFFFFF] text-[#686868] border border-[#E5E1DB] font-semibold' 
                      : 'text-[#686868] hover:text-[#252525]'
                  }`}
                >
                  Invalid ({summary.invalid_format})
                </button>
              </div>

              {/* Search & Export */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 md:w-64">
                  <Search className="w-4 h-4 text-[#686868] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search address or domain..." 
                    className="w-full bg-[#FFFFFF] border border-[#E5E1DB] rounded-lg pl-9 pr-3 py-1.5 text-xs font-sans text-[#252525] placeholder-[#686868]/60 focus:outline-none focus:ring-1 focus:ring-[#C66A32]"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={handleExportCsv}
                  className="px-3.5 py-1.5 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#252525] hover:text-[#C66A32] border border-[#E5E1DB] font-sans font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#C66A32]" />
                  <span>Export CSV</span>
                </button>
              </div>

            </div>

            {/* Desktop Table & Mobile Card View */}
            <div className="bg-[#FFFFFF] rounded-xl border border-[#E5E1DB] overflow-hidden">
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F5F4F0] border-b border-[#E5E1DB] text-[#686868] font-sans font-medium">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4 min-w-[210px]">Email Address</th>
                      <th className="py-3.5 px-4 min-w-[150px]">Status</th>
                      <th className="py-3.5 px-4 min-w-[280px]">Reason & Assessment</th>
                      <th className="py-3.5 px-4 min-w-[230px]">Checks Performed</th>
                      <th className="py-3.5 px-4 w-28 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1DB]">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-[#686868] text-xs font-sans">
                          No email addresses match your selected filter or search query.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="py-3.5 px-4 font-mono text-[#686868] text-center text-xs">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-mono font-medium text-[#252525] text-xs break-all select-all">{item.email}</td>
                          <td className="py-3.5 px-4">
                            {renderStatusBadge(item.status)}
                          </td>
                          <td className="py-3.5 px-4 text-[#252525] text-xs leading-relaxed font-sans">{item.reason}</td>
                          <td className="py-3.5 px-4">
                            {renderCheckBadges(item.checks_performed || { syntax_valid: false, domain_exists: false, mx_records_found: false, disposable_domain: false, role_account: false })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                type="button" 
                                onClick={() => setInspectItem(item)}
                                className="px-2.5 py-1 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#252525] hover:text-[#C66A32] rounded text-xs font-sans font-medium transition-colors flex items-center gap-1 cursor-pointer border border-[#E5E1DB]"
                              >
                                <span>Details</span>
                                <ChevronRight className="w-3.5 h-3.5 text-[#686868]" />
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleCopy(item.email, idx)}
                                className="p-1.5 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#686868] hover:text-[#252525] rounded text-xs transition-colors cursor-pointer border border-[#E5E1DB]"
                                title="Copy address"
                              >
                                {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-[#367553]" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden divide-y divide-[#E5E1DB]">
                {filteredResults.length === 0 ? (
                  <div className="py-10 text-center text-[#686868] text-xs font-sans px-4">
                    No email addresses match your selected filter or search query.
                  </div>
                ) : (
                  filteredResults.map((item, idx) => (
                    <div key={idx} className="p-4 space-y-3 bg-[#FFFFFF]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#686868]">#{idx + 1}</span>
                          <span className="font-mono font-medium text-xs text-[#252525] break-all select-all">{item.email}</span>
                        </div>
                        {renderStatusBadge(item.status)}
                      </div>

                      <p className="text-xs text-[#252525] leading-relaxed font-sans">{item.reason}</p>

                      <div className="pt-1">
                        {renderCheckBadges(item.checks_performed || { syntax_valid: false, domain_exists: false, mx_records_found: false, disposable_domain: false, role_account: false })}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E1DB]/50">
                        <button 
                          type="button" 
                          onClick={() => setInspectItem(item)}
                          className="px-3 py-1 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#252525] hover:text-[#C66A32] rounded text-xs font-sans font-medium transition-colors flex items-center gap-1 cursor-pointer border border-[#E5E1DB]"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#686868]" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleCopy(item.email, idx)}
                          className="px-3 py-1 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#686868] hover:text-[#252525] rounded text-xs font-sans font-medium transition-colors flex items-center gap-1 cursor-pointer border border-[#E5E1DB]"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#367553]" />
                              <span className="text-[#367553]">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          </section>
        )}

      </main>

      {/* Inspect Item Modal */}
      {inspectItem && (
        <div className="fixed inset-0 bg-[#252525]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E5E1DB] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl relative text-[#252525] font-sans">
            <button 
              onClick={() => setInspectItem(null)}
              className="absolute top-4 right-4 text-[#686868] hover:text-[#252525] p-1 rounded-lg hover:bg-[#F5F4F0] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-sans text-[#C66A32] font-semibold">Inspection Record</span>
              <h3 className="text-base font-mono font-bold text-[#252525] break-all">{inspectItem.email}</h3>
              <p className="text-xs text-[#686868] font-mono">Domain: {inspectItem.domain}</p>
            </div>

            <div className="space-y-2.5 bg-[#F5F4F0] rounded-lg p-4 border border-[#E5E1DB] text-xs font-sans">
              <div className="flex items-center justify-between">
                <span className="text-[#686868]">Classification:</span>
                <span className="font-semibold text-[#252525]">{inspectItem.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#686868]">Mailbox Verified:</span>
                <span className="text-[#A66D24]">False (Domain Estimate)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#686868]">Role Address:</span>
                <span className="text-[#252525]">{inspectItem.checks_performed.role_account ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#686868]">Disposable Service:</span>
                <span className="text-[#252525]">{inspectItem.checks_performed.disposable_domain ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {inspectItem.checks_performed.mx_hosts && inspectItem.checks_performed.mx_hosts.length > 0 && (
              <div className="space-y-1.5 font-sans">
                <h4 className="text-xs font-semibold text-[#252525]">Mail Exchanger (MX) Records:</h4>
                <div className="bg-[#F5F4F0] rounded-lg p-3 border border-[#E5E1DB] space-y-1">
                  {inspectItem.checks_performed.mx_hosts.map((mx, idx) => (
                    <div key={idx} className="font-mono text-xs text-[#367553] flex items-center gap-2">
                      <span className="text-[#686868]">[{idx + 1}]</span>
                      <span>{mx}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 font-sans">
              <h4 className="text-xs font-semibold text-[#252525]">Reasoning Assessment:</h4>
              <p className="text-xs text-[#686868] leading-relaxed bg-[#F5F4F0] p-3 rounded-lg border border-[#E5E1DB]">
                {inspectItem.reason}
              </p>
            </div>

            <button 
              type="button" 
              onClick={() => setInspectItem(null)}
              className="w-full py-2 bg-[#F5F4F0] hover:bg-[#F8EEE6] text-[#252525] hover:text-[#C66A32] text-xs font-sans font-medium rounded-lg transition-colors cursor-pointer border border-[#E5E1DB]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Charcoal Footer */}
      <footer className="bg-[#202020] text-[#F5F4F0] px-6 py-5 text-xs font-sans mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-white">MailMate</span> — Check first. Send smarter.
          </div>
          <div className="text-center sm:text-right text-[11px] text-[#A6A6A6] max-w-lg leading-relaxed font-sans">
            Domain-level DNS and syntax checks confirm server routing configuration, but cannot guarantee individual mailbox existence or successful delivery.
          </div>
        </div>
      </footer>

    </div>
  );
}
