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
  AlertTriangle,
  Inbox,
  Layers,
  Filter,
  FileText
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

export function normalizeStatus(rawStatus?: string | null): 'Likely Deliverable' | 'Likely to Bounce' | 'Unknown' | 'Invalid Format' {
  if (!rawStatus) return 'Unknown';
  const clean = String(rawStatus).trim().toLowerCase().replace(/[_\s-]+/g, ' ');
  if (
    clean === 'likely deliverable' ||
    clean === 'likely delivered' ||
    clean === 'likely to be delivered' ||
    clean === 'deliverable' ||
    clean === 'delivered'
  ) {
    return 'Likely Deliverable';
  }
  if (
    clean === 'likely to bounce' ||
    clean === 'bounce' ||
    clean === 'bounced'
  ) {
    return 'Likely to Bounce';
  }
  if (
    clean === 'invalid format' ||
    clean === 'invalid' ||
    clean === 'invalid syntax'
  ) {
    return 'Invalid Format';
  }
  return 'Unknown';
}

export function calculateKPIsFromResults(resultsList: EmailResult[]): SummaryStats {
  const total = resultsList.length;
  let likely_deliverable = 0;
  let likely_to_bounce = 0;
  let unknown = 0;
  let invalid_format = 0;

  for (const item of resultsList) {
    const norm = normalizeStatus(item.status);
    if (norm === 'Likely Deliverable') {
      likely_deliverable++;
    } else if (norm === 'Likely to Bounce') {
      likely_to_bounce++;
    } else if (norm === 'Unknown') {
      unknown++;
    } else if (norm === 'Invalid Format') {
      invalid_format++;
    }
  }

  return {
    total,
    likely_deliverable,
    likely_to_bounce,
    unknown,
    invalid_format
  };
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
  // Input starts completely empty on initial load
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<EmailResult[]>([]);
  const [hasRunCheck, setHasRunCheck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'Likely Deliverable' | 'Likely to Bounce' | 'Unknown' | 'Invalid Format'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [inspectItem, setInspectItem] = useState<EmailResult | null>(null);

  // Calculate every KPI directly from the complete processed results array (results),
  // NOT from filteredResults (the currently filtered or searched table).
  const summary = useMemo<SummaryStats | null>(() => {
    if (!hasRunCheck && results.length === 0) return null;
    return calculateKPIsFromResults(results);
  }, [results, hasRunCheck]);

  // Extract non-empty email tokens
  const extractedEmails = useMemo(() => {
    if (!inputText.trim()) return [];
    return inputText.split(/[\r\n,;\s]+/).map(s => s.trim()).filter(Boolean);
  }, [inputText]);

  const handleRunCheck = async () => {
    setErrorMsg(null);
    if (extractedEmails.length === 0) {
      setErrorMsg('Add at least one email address to continue.');
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
        throw new Error(data.error || "We couldn't complete this check. Please try again.");
      }

      const rawResults = data.results || [];
      const normalizedResults: EmailResult[] = rawResults.map((item: any) => ({
        ...item,
        status: normalizeStatus(item.status)
      }));

      setResults(normalizedResults);
      setHasRunCheck(true);
      setActiveTab('all');
    } catch (err: any) {
      setErrorMsg(err.message || "We couldn't complete this check. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    setInputText('');
    setResults([]);
    setHasRunCheck(false);
    setErrorMsg(null);
    setSearchQuery('');
    setActiveTab('all');
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const filteredResults = useMemo(() => {
    return results.filter(item => {
      const itemStatus = normalizeStatus(item.status);
      if (activeTab !== 'all' && itemStatus !== activeTab) {
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
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium bg-[#D4EAD9] text-[#2B5C40] border border-[#B9DCC0] shrink-0 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2B5C40]"></span>
            <span>Likely Deliverable</span>
          </span>
        );
      case 'Likely to Bounce':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium bg-[#FADBD8] text-[#902A24] border border-[#F5B7B1] shrink-0 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#902A24]"></span>
            <span>Likely to Bounce</span>
          </span>
        );
      case 'Unknown':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium bg-[#FDEBD0] text-[#7E5109] border border-[#FAD7A0] shrink-0 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7E5109]"></span>
            <span>Unknown</span>
          </span>
        );
      case 'Invalid Format':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium bg-[#EFECE6] text-[#5C5955] border border-[#E2DDD5] shrink-0 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5C5955]"></span>
            <span>Invalid Format</span>
          </span>
        );
    }
  };

  const renderCheckBadges = (c: CheckPerformed) => {
    return (
      <div className="flex flex-wrap gap-1.5">
        {c.syntax_valid ? (
          <span className="px-2.5 py-1 rounded-full bg-[#EFECE6] text-[#4A4742] text-[11px] font-sans font-medium border border-[#E2DDD5] whitespace-nowrap">Syntax · Valid</span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-[#FADBD8] text-[#902A24] text-[11px] font-sans font-medium border border-[#F5B7B1] whitespace-nowrap">Syntax · Invalid</span>
        )}

        {c.dns_status === 'Skipped (Invalid Syntax)' || !c.syntax_valid ? (
          <span className="px-2.5 py-1 rounded-full bg-[#EFECE6] text-[#686868] text-[11px] font-sans font-medium border border-[#E2DDD5] whitespace-nowrap">DNS · Not Checked</span>
        ) : c.dns_status === 'TIMEOUT' ? (
          <span className="px-2.5 py-1 rounded-full bg-[#FDEBD0] text-[#7E5109] text-[11px] font-sans font-medium border border-[#FAD7A0] whitespace-nowrap">DNS · Timed Out</span>
        ) : c.dns_status === 'DNS_SERVER_ERROR' ? (
          <span className="px-2.5 py-1 rounded-full bg-[#FDEBD0] text-[#7E5109] text-[11px] font-sans font-medium border border-[#FAD7A0] whitespace-nowrap">DNS · Error</span>
        ) : c.domain_exists ? (
          <span className="px-2.5 py-1 rounded-full bg-[#EFECE6] text-[#4A4742] text-[11px] font-sans font-medium border border-[#E2DDD5] whitespace-nowrap">DNS · Resolved</span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-[#FADBD8] text-[#902A24] text-[11px] font-sans font-medium border border-[#F5B7B1] whitespace-nowrap">DNS · Not Found</span>
        )}

        {!c.syntax_valid ? (
          <span className="px-2.5 py-1 rounded-full bg-[#EFECE6] text-[#686868] text-[11px] font-sans font-medium border border-[#E2DDD5] whitespace-nowrap">MX · Not Checked</span>
        ) : c.mx_records_found ? (
          <span className="px-2.5 py-1 rounded-full bg-[#D4EAD9] text-[#2B5C40] text-[11px] font-sans font-medium border border-[#B9DCC0] whitespace-nowrap">MX · Found</span>
        ) : c.is_null_mx ? (
          <span className="px-2.5 py-1 rounded-full bg-[#FADBD8] text-[#902A24] text-[11px] font-sans font-medium border border-[#F5B7B1] whitespace-nowrap">MX · Null MX</span>
        ) : c.has_fallback_a ? (
          <span className="px-2.5 py-1 rounded-full bg-[#FDEBD0] text-[#7E5109] text-[11px] font-sans font-medium border border-[#FAD7A0] whitespace-nowrap">MX · Fallback A</span>
        ) : c.domain_exists === false ? (
          <span className="px-2.5 py-1 rounded-full bg-[#FADBD8] text-[#902A24] text-[11px] font-sans font-medium border border-[#F5B7B1] whitespace-nowrap">MX · Not Found</span>
        ) : (
          <span className="px-2.5 py-1 rounded-full bg-[#FDEBD0] text-[#7E5109] text-[11px] font-sans font-medium border border-[#FAD7A0] whitespace-nowrap">MX · Inconclusive</span>
        )}

        {c.disposable_domain && (
          <span className="px-2.5 py-1 rounded-full bg-[#FADBD8] text-[#902A24] text-[11px] font-sans font-medium border border-[#F5B7B1] whitespace-nowrap">Disposable Domain</span>
        )}

        {c.role_account && (
          <span className="px-2.5 py-1 rounded-full bg-[#F8EEE6] text-[#C66A32] text-[11px] font-sans font-medium border border-[#E8E5DF] whitespace-nowrap">Role Address</span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#F6F3EB] text-[#1F1C18] min-h-screen font-sans flex flex-col antialiased">
      
      {/* 1. Top Navigation Bar — Soft Warm Luxury Header */}
      <header className="bg-[#FAF7F0]/90 backdrop-blur-md border-b border-[#E8E2D5] px-6 py-4 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-8">
          
          {/* Zone 1: Logo inside warm soft pill container */}
          <div className="flex items-center gap-2.5 shrink-0 bg-[#EFECE4] border border-[#D9D0C1] px-3.5 py-1.5 rounded-2xl shadow-2xs">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-b from-[#D9C09E] to-[#C4A47C] flex items-center justify-center text-[#3D2914] shadow-2xs">
              <Mail className="w-3.5 h-3.5" />
            </div>
            <span className="text-base font-bold tracking-tight text-[#1F1C18] whitespace-nowrap">
              MailMate
            </span>
          </div>

          {/* Zone 2: Centered quiet tagline */}
          <div className="hidden sm:flex items-center text-xs font-medium text-[#787167] whitespace-nowrap tracking-wide">
            <span>Check first. Send smarter.</span>
          </div>

          {/* Zone 3: Privacy indicator badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFECE4] text-[#6B573B] border border-[#C6A87C]/50 text-[11px] font-medium shadow-2xs whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2B5C40]" />
              <span>Privacy-first checks</span>
            </div>
          </div>

        </div>
      </header>

      {/* Main Editorial Canvas Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 space-y-10">
        
        {/* 2. Hero & Purpose Section — Warm Editorial Aesthetics */}
        <section className="space-y-4">
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight text-[#1C1917] tracking-tight">
            Know which emails are likely to get through.
          </h1>
          <p className="text-[#6E675F] text-sm sm:text-base max-w-xl font-normal leading-relaxed">
            Check email addresses for likely deliverability, potential bounces, and uncertain results.
          </p>
          
          {/* Feature Pill Badges */}
          <div className="pt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#5E482D]">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFECE4] border border-[#C6A87C]/70 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2B5C40]" />
                <span>Check Deliverability</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFECE4] border border-[#C6A87C]/70 shadow-2xs">
                <XCircle className="w-3.5 h-3.5 text-[#902A24]" />
                <span>Spot Potential Bounces</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFECE4] border border-[#C6A87C]/70 shadow-2xs">
                <HelpCircle className="w-3.5 h-3.5 text-[#7E5109]" />
                <span>See Uncertain Results</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#787167] pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFECE4]/80 border border-[#D9D0C1]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2B5C40]"></span>
                <span>No emails are sent</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFECE4]/80 border border-[#D9D0C1]">
                <Mail className="w-3 h-3 text-[#787167]" />
                <span>No mailbox access needed</span>
              </span>
            </div>
          </div>
        </section>

        {/* 3. Primary Interactive Input Area — Golden Framed Container */}
        <section className="bg-[#FAF7F0] rounded-[2rem] border-2 border-[#C6A87C]/60 p-6 sm:p-7 space-y-5 shadow-[0_12px_40px_rgba(180,140,80,0.12)] relative">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label htmlFor="emailInput" className="text-sm font-semibold text-[#1C1917] block font-sans">
                Check your email list
              </label>
              <p className="text-xs text-[#787167] font-sans">Paste email addresses separated by commas, semicolons, or line breaks.</p>
            </div>

            {/* Top-Right Secondary Action Group */}
            <div className="flex items-center gap-3 text-xs font-sans">
              <button 
                type="button" 
                onClick={() => setInputText(SAMPLE_BATCH)}
                className="bg-gradient-to-r from-[#D9C09E] to-[#C4A47C] hover:from-[#CCA87B] hover:to-[#B89363] text-[#3D2914] px-3.5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5 cursor-pointer border border-[#C4A47C]/70 shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#3D2914]" />
                <span>Try sample addresses</span>
              </button>
              {inputText.length > 0 && (
                <button 
                  type="button" 
                  onClick={handleClearAll}
                  className="text-[#787167] hover:text-[#902A24] transition-colors cursor-pointer font-medium px-2 py-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Inset Rounded Textarea Box */}
          <div className="bg-[#EFECE4] border border-[#D9D0C1] rounded-2xl p-3.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-[#B88A4C] focus-within:border-[#B88A4C] transition-all">
            <textarea 
              id="emailInput"
              rows={5}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your email addresses here..."
              className="w-full bg-transparent border-0 text-xs sm:text-sm font-mono text-[#1C1917] placeholder-[#787167]/60 focus:outline-none resize-y"
            />
          </div>

          {errorMsg && (
            <div className="bg-[#FDF2F2] border border-[#B84C43]/30 rounded-xl p-3 text-[#902A24] text-xs font-sans flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#902A24]" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Primary Action Button Row — Center Elevated Golden CTA */}
          <div className="flex flex-col items-center justify-center gap-3 pt-2">
            <button 
              type="button" 
              onClick={handleRunCheck}
              disabled={loading}
              className="bg-gradient-to-b from-[#7A4B1B] via-[#8C5824] to-[#593410] hover:brightness-110 active:scale-98 text-[#FFF9F2] font-sans font-semibold text-sm px-9 py-3 rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-[#D9B382]/60 shadow-[0_8px_24px_rgba(120,70,20,0.35)]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#FFF9F2]" />
                  <span>Assessing addresses...</span>
                </>
              ) : (
                <>
                  <span>Assess List</span>
                </>
              )}
            </button>

            <div className="text-[11px] font-mono text-[#787167]">
              <span className={extractedEmails.length > 100 ? 'text-[#902A24] font-semibold' : 'font-medium'}>
                {extractedEmails.length}
              </span> / 100 max addresses
            </div>
          </div>
        </section>

        {/* 4. Results Section or Initial Empty State */}
        {!summary ? (
          <section className="bg-[#FFFFFF] rounded-xl border border-[#E8E5DF] p-12 text-center space-y-2 font-sans">
            <div className="w-10 h-10 rounded-full bg-[#F8EEE6] border border-[#E8E5DF] flex items-center justify-center text-[#B96332] mx-auto">
              <Inbox className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[#262522]">Your results will appear here</h3>
            <p className="text-xs text-[#77736D] max-w-xs mx-auto leading-relaxed">
              Paste email addresses above and click "Check emails" to view deliverability analysis.
            </p>
          </section>
        ) : (
          <section className="space-y-8 font-sans">
            
            {/* 5. Metric Cards Grid matching attached reference layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 font-sans">
              
              {/* Total Processed */}
              <div 
                onClick={() => setActiveTab('all')}
                className={`rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-32 relative border ${
                  activeTab === 'all' 
                    ? 'bg-[#F3F3FE] border-[#635BFF] ring-2 ring-[#635BFF]/20 shadow-xs' 
                    : 'bg-[#F3F3FE]/70 border-[#E0DFFA] hover:border-[#635BFF]/60 hover:bg-[#F3F3FE]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-[#3B33C6]">Total Processed</span>
                  <div className="w-7 h-7 rounded-full bg-[#E0DFFA] flex items-center justify-center text-[#635BFF]">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono tabular-nums font-bold text-[#1E1B4B]">{summary.total}</span>
                  <span className="text-sm font-sans font-medium text-[#635BFF] opacity-80">
                    — {summary.total > 0 ? '100%' : '0%'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-[#635BFF]/80 flex items-center gap-1 pt-1">
                  <Filter className="w-3 h-3 text-[#635BFF]" />
                  <span>{activeTab === 'all' ? 'Active filter (click to reset)' : 'Click to filter'}</span>
                </div>
              </div>

              {/* Likely to be delivered */}
              <div 
                onClick={() => setActiveTab(activeTab === 'Likely Deliverable' ? 'all' : 'Likely Deliverable')}
                className={`rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-32 relative border ${
                  activeTab === 'Likely Deliverable' 
                    ? 'bg-[#EAF7F0] border-[#39775B] ring-2 ring-[#39775B]/20 shadow-xs' 
                    : 'bg-[#EAF7F0]/70 border-[#D2EFE0] hover:border-[#39775B]/60 hover:bg-[#EAF7F0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-[#1E563B]">Likely to be delivered</span>
                  <div className="w-7 h-7 rounded-full bg-[#D2EFE0] flex items-center justify-center text-[#39775B]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono tabular-nums font-bold text-[#1E563B]">{summary.likely_deliverable}</span>
                  <span className="text-sm font-sans font-medium text-[#39775B] opacity-80">
                    — {summary.total ? `${Math.round((summary.likely_deliverable / summary.total) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-[#39775B]/80 flex items-center gap-1 pt-1">
                  <Filter className="w-3 h-3 text-[#39775B]" />
                  <span>{activeTab === 'Likely Deliverable' ? 'Active filter (click to reset)' : 'Click to filter'}</span>
                </div>
              </div>

              {/* Likely to bounce */}
              <div 
                onClick={() => setActiveTab(activeTab === 'Likely to Bounce' ? 'all' : 'Likely to Bounce')}
                className={`rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-32 relative border ${
                  activeTab === 'Likely to Bounce' 
                    ? 'bg-[#FDF2F2] border-[#B84C43] ring-2 ring-[#B84C43]/20 shadow-xs' 
                    : 'bg-[#FDF2F2]/70 border-[#F8D7D5] hover:border-[#B84C43]/60 hover:bg-[#FDF2F2]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-[#9B322A]">Likely to bounce</span>
                  <div className="w-7 h-7 rounded-full bg-[#F8D7D5] flex items-center justify-center text-[#B84C43]">
                    <XCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono tabular-nums font-bold text-[#9B322A]">{summary.likely_to_bounce}</span>
                  <span className="text-sm font-sans font-medium text-[#B84C43] opacity-80">
                    — {summary.total ? `${Math.round((summary.likely_to_bounce / summary.total) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-[#B84C43]/80 flex items-center gap-1 pt-1">
                  <Filter className="w-3 h-3 text-[#B84C43]" />
                  <span>{activeTab === 'Likely to Bounce' ? 'Active filter (click to reset)' : 'Click to filter'}</span>
                </div>
              </div>

              {/* Unknown */}
              <div 
                onClick={() => setActiveTab(activeTab === 'Unknown' ? 'all' : 'Unknown')}
                className={`rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-32 relative border ${
                  activeTab === 'Unknown' 
                    ? 'bg-[#FEFAF0] border-[#A87530] ring-2 ring-[#A87530]/20 shadow-xs' 
                    : 'bg-[#FEFAF0]/70 border-[#F9ECCE] hover:border-[#A87530]/60 hover:bg-[#FEFAF0]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-[#855B21]">Unknown</span>
                  <div className="w-7 h-7 rounded-full bg-[#F9ECCE] flex items-center justify-center text-[#A87530]">
                    <HelpCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono tabular-nums font-bold text-[#855B21]">{summary.unknown}</span>
                  <span className="text-sm font-sans font-medium text-[#A87530] opacity-80">
                    — {summary.total ? `${Math.round((summary.unknown / summary.total) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-[#A87530]/80 flex items-center gap-1 pt-1">
                  <Filter className="w-3 h-3 text-[#A87530]" />
                  <span>{activeTab === 'Unknown' ? 'Active filter (click to reset)' : 'Click to filter'}</span>
                </div>
              </div>

              {/* Invalid Format */}
              <div 
                onClick={() => setActiveTab(activeTab === 'Invalid Format' ? 'all' : 'Invalid Format')}
                className={`rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-32 relative border ${
                  activeTab === 'Invalid Format' 
                    ? 'bg-[#EFECE6] border-[#787167] ring-2 ring-[#787167]/20 shadow-xs' 
                    : 'bg-[#EFECE6]/70 border-[#E2DDD5] hover:border-[#787167]/60 hover:bg-[#EFECE6]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-[#4A4742]">Invalid Format</span>
                  <div className="w-7 h-7 rounded-full bg-[#E2DDD5] flex items-center justify-center text-[#5C5955]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono tabular-nums font-bold text-[#4A4742]">{summary.invalid_format}</span>
                  <span className="text-sm font-sans font-medium text-[#5C5955] opacity-80">
                    — {summary.total ? `${Math.round((summary.invalid_format / summary.total) * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-[#5C5955]/80 flex items-center gap-1 pt-1">
                  <Filter className="w-3 h-3 text-[#5C5955]" />
                  <span>{activeTab === 'Invalid Format' ? 'Active filter (click to reset)' : 'Click to filter'}</span>
                </div>
              </div>

            </div>

            {/* 6. Results Toolbar — Streamlined Rounded Card with Capsule Tabs matching screenshot */}
            <div className="bg-[#FAF8F5] rounded-3xl border border-[#E8E4DC] p-3 sm:p-3.5 shadow-2xs space-y-3 sm:space-y-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
              
              {/* Left side: Search bar with magnifying glass */}
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-[#686868] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email address or status reason..." 
                  className="w-full bg-[#EFECE6] border border-[#E2DDD5] rounded-full pl-9 pr-4 py-2 text-xs font-sans text-[#252525] placeholder-[#686868]/70 focus:outline-none focus:ring-1 focus:ring-[#C66A32] focus:bg-[#FFFFFF] transition-all"
                />
              </div>

              {/* Right side: Segmented tab capsule + Export CSV */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <div className="flex items-center gap-1 bg-[#E5E1DA] p-1 rounded-full border border-[#DDD8CF] overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-1.5 text-xs font-sans rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'all' 
                        ? 'bg-[#FFFFFF] text-[#252525] shadow-xs font-semibold' 
                        : 'text-[#5C5955] hover:text-[#252525] font-medium'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Likely Deliverable')}
                    className={`px-3.5 py-1.5 text-xs font-sans rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'Likely Deliverable' 
                        ? 'bg-[#FFFFFF] text-[#2B5C40] shadow-xs font-semibold' 
                        : 'text-[#5C5955] hover:text-[#252525] font-medium'
                    }`}
                  >
                    Likely to be delivered
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Likely to Bounce')}
                    className={`px-3.5 py-1.5 text-xs font-sans rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'Likely to Bounce' 
                        ? 'bg-[#FFFFFF] text-[#902A24] shadow-xs font-semibold' 
                        : 'text-[#5C5955] hover:text-[#252525] font-medium'
                    }`}
                  >
                    Likely to bounce
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Unknown')}
                    className={`px-3.5 py-1.5 text-xs font-sans rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'Unknown' 
                        ? 'bg-[#FFFFFF] text-[#7E5109] shadow-xs font-semibold' 
                        : 'text-[#5C5955] hover:text-[#252525] font-medium'
                    }`}
                  >
                    Unknown
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Invalid Format')}
                    className={`px-3.5 py-1.5 text-xs font-sans rounded-full transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === 'Invalid Format' 
                        ? 'bg-[#FFFFFF] text-[#5C5955] shadow-xs font-semibold' 
                        : 'text-[#5C5955] hover:text-[#252525] font-medium'
                    }`}
                  >
                    Invalid Format
                  </button>
                </div>

                <button 
                  type="button" 
                  onClick={handleExportCsv}
                  className="px-4 py-2 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#252522] hover:text-[#C66A32] border border-[#E2DDD5] font-sans font-medium text-xs rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-[#252522]" />
                  <span>Export CSV</span>
                </button>
              </div>

            </div>

            {/* 7. Polished Data Table View matching image screenshot */}
            <div className="bg-[#FFFFFF] rounded-3xl border border-[#E8E4DC] overflow-hidden shadow-2xs">
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F2EFE8] border-b border-[#E8E4DC] text-[#252522] font-sans font-medium">
                      <th className="py-3.5 px-5 w-12 text-center">#</th>
                      <th className="py-3.5 px-5 min-w-[200px]">Email Address</th>
                      <th className="py-3.5 px-5 min-w-[150px]">Status</th>
                      <th className="py-3.5 px-5 min-w-[280px]">Reason & Assessment</th>
                      <th className="py-3.5 px-5 min-w-[240px]">Checks Performed</th>
                      <th className="py-3.5 px-5 w-32 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E4DC]/60">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-xs font-sans">
                          {searchQuery ? (
                            <div className="space-y-1">
                              <p className="font-semibold text-[#252525]">No emails found</p>
                              <p className="text-[#686868]">Try a different search term.</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-semibold text-[#252525]">No matching results</p>
                              <p className="text-[#686868]">Try another filter or clear your search.</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-4 px-5 font-mono text-[#686868] text-center text-xs tabular-nums">{idx + 1}</td>
                          <td className="py-4 px-5 font-mono font-medium text-[#252525] text-xs break-all select-all">{item.email}</td>
                          <td className="py-4 px-5">
                            {renderStatusBadge(item.status)}
                          </td>
                          <td className="py-4 px-5 text-[#252525] text-xs leading-relaxed font-sans">{item.reason}</td>
                          <td className="py-4 px-5">
                            {renderCheckBadges(item.checks_performed || { syntax_valid: false, domain_exists: false, mx_records_found: false, disposable_domain: false, role_account: false })}
                          </td>
                          <td className="py-4 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <button 
                                type="button" 
                                onClick={() => setInspectItem(item)}
                                className="px-3.5 py-1.5 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#252522] hover:text-[#C66A32] rounded-full text-xs font-sans font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer border border-[#E2DDD5] shadow-2xs whitespace-nowrap"
                              >
                                <FileText className="w-3.5 h-3.5 text-[#686868]" />
                                <span>View details</span>
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleCopy(item.email, idx)}
                                className="p-1.5 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#686868] hover:text-[#252522] rounded-full text-xs transition-colors inline-flex items-center cursor-pointer border border-[#E2DDD5] shadow-2xs whitespace-nowrap"
                                title="Copy email"
                              >
                                {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-[#2B5C40]" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="block md:hidden divide-y divide-[#E8E5DF]">
                {filteredResults.length === 0 ? (
                  <div className="py-12 text-center text-xs font-sans px-4">
                    {searchQuery ? (
                      <div className="space-y-1">
                        <p className="font-semibold text-[#262522]">No emails found</p>
                        <p className="text-[#77736D]">Try a different search term.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold text-[#262522]">No matching results</p>
                        <p className="text-[#77736D]">Try another filter or clear your search.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredResults.map((item, idx) => (
                    <div key={idx} className="p-4 space-y-3 bg-[#FFFFFF]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#77736D]">#{idx + 1}</span>
                          <span className="font-mono font-medium text-xs text-[#262522] break-all select-all">{item.email}</span>
                        </div>
                        {renderStatusBadge(item.status)}
                      </div>

                      <p className="text-xs text-[#262522] leading-relaxed font-sans">{item.reason}</p>

                      <div className="pt-1">
                        {renderCheckBadges(item.checks_performed || { syntax_valid: false, domain_exists: false, mx_records_found: false, disposable_domain: false, role_account: false })}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8E5DF]/60">
                        <button 
                          type="button" 
                          onClick={() => setInspectItem(item)}
                          className="px-3 py-1 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#262522] hover:text-[#B96332] rounded text-xs font-sans font-medium transition-colors flex items-center gap-1 cursor-pointer border border-[#E8E5DF] whitespace-nowrap"
                        >
                          <span>View details</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#77736D]" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleCopy(item.email, idx)}
                          className="px-3 py-1 bg-[#FFFFFF] hover:bg-[#F8EEE6] text-[#77736D] hover:text-[#262522] rounded text-xs font-sans font-medium transition-colors flex items-center gap-1 cursor-pointer border border-[#E8E5DF] whitespace-nowrap"
                        >
                          {copiedIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#39775B]" />
                              <span className="text-[#39775B]">Email copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy email</span>
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

      {/* Diagnostic Details Modal */}
      {inspectItem && (
        <div className="fixed inset-0 bg-[#262522]/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl relative text-[#262522] font-sans">
            <button 
              onClick={() => setInspectItem(null)}
              className="absolute top-4 right-4 text-[#77736D] hover:text-[#262522] p-1 rounded-lg hover:bg-[#F7F6F2] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <span className="text-xs font-sans text-[#B96332] font-semibold">Diagnostic details</span>
              <h3 className="text-base font-mono font-bold text-[#262522] break-all">{inspectItem.email}</h3>
              <p className="text-xs text-[#77736D] font-mono">Domain: {inspectItem.domain}</p>
            </div>

            <div className="space-y-2.5 bg-[#F7F6F2] rounded-lg p-4 border border-[#E8E5DF] text-xs font-sans">
              <div className="flex items-center justify-between">
                <span className="text-[#77736D]">Classification:</span>
                <span className="font-semibold text-[#262522]">{inspectItem.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#77736D]">Mailbox Verified:</span>
                <span className="text-[#A87530]">False (Domain Infrastructure Estimate)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#77736D]">Role Address:</span>
                <span className="text-[#262522]">{inspectItem.checks_performed.role_account ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#77736D]">Disposable Service:</span>
                <span className="text-[#262522]">{inspectItem.checks_performed.disposable_domain ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {inspectItem.checks_performed.mx_hosts && inspectItem.checks_performed.mx_hosts.length > 0 && (
              <div className="space-y-1.5 font-sans">
                <h4 className="text-xs font-semibold text-[#262522]">Mail Exchanger (MX) Records:</h4>
                <div className="bg-[#F7F6F2] rounded-lg p-3 border border-[#E8E5DF] space-y-1">
                  {inspectItem.checks_performed.mx_hosts.map((mx, idx) => (
                    <div key={idx} className="font-mono text-xs text-[#39775B] flex items-center gap-2">
                      <span className="text-[#77736D]">[{idx + 1}]</span>
                      <span>{mx}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 font-sans">
              <h4 className="text-xs font-semibold text-[#262522]">Verification Assessment:</h4>
              <p className="text-xs text-[#77736D] leading-relaxed bg-[#F7F6F2] p-3 rounded-lg border border-[#E8E5DF]">
                {inspectItem.reason}
              </p>
            </div>

            <button 
              type="button" 
              onClick={() => setInspectItem(null)}
              className="w-full py-2 bg-[#F7F6F2] hover:bg-[#F8EEE6] text-[#262522] hover:text-[#B96332] text-xs font-sans font-medium rounded-lg transition-colors cursor-pointer border border-[#E8E5DF]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 8. Elegant Light Editorial Footer */}
      <footer className="bg-[#F7F6F2] border-t border-[#E8E5DF] text-[#77736D] px-6 py-6 text-xs font-sans mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-[#262522]">MailMate</span> — Check first. Send smarter.
          </div>
          <div className="text-center sm:text-right text-[11px] text-[#77736D] max-w-md leading-relaxed font-sans">
            Domain-level DNS and syntax checks confirm server routing configuration, but cannot guarantee individual mailbox existence or final delivery.
          </div>
        </div>
      </footer>

    </div>
  );
}
