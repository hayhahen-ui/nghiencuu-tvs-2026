"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Activity,
  AlertCircle,
  Atom,
  BrainCircuit,
  ChartNoAxesCombined,
  Compass,
  Dna,
  Earth,
  HeartPulse,
  Server,
  Settings,
  Sigma,
  ArrowDownToLine,
  ArrowRight,
  Beaker,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  FileCode2,
  Files,
  FlaskConical,
  FolderKanban,
  Globe2,
  LayoutDashboard,
  LibraryBig,
  LoaderCircle,
  Menu,
  MessageSquare,
  Microscope,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
  History,
  Clock,
  FileText,
  Printer,
  Sun,
  Moon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Papa from "papaparse";
import { describe, sequenceStats } from "@/lib/analysis";
import { filterSkills } from "@/lib/skill-filters";
import { selectSkills, selectionState } from "@/lib/skill-selection";
import type { SkillContextInfo } from "@/lib/chat-context";
import { projectsSchema } from "@/lib/projects";
import type { Catalog, Paper, Project, Skill } from "@/lib/types";
import ResearchSources, { SourcePreview, type SourceLocation } from "./research-sources";
import { loadDocuments } from "@/lib/document-store";
import {
  loadChatSessions,
  saveChatSession,
  deleteChatSession,
  clearAllChatSessions,
  exportSessionToMarkdown,
  generateScientificWordDocument,
  openScientificPdfPrintView,
  type ChatSession,
  type ChatMessageItem,
} from "@/lib/chat-history-store";
import { selectDocumentEvidence, type StoredDocument, type EvidenceReceipt } from "@/lib/research-documents";

const scienceIcons: Record<string, typeof Microscope> = {
  flask: FlaskConical, dna: Dna, atom: Atom, earth: Earth, heart: HeartPulse,
  sigma: Sigma, brain: BrainCircuit, gear: Settings, chart: ChartNoAxesCombined,
  compass: Compass, book: BookOpen, server: Server,
};
function ScienceIcon({ icon, size = 21 }: { icon?: string; size?: number }) {
  const Icon = scienceIcons[icon || ""] || Microscope;
  return <Icon size={size} aria-hidden="true" />;
}

function SkillSelectionCheckbox({ selected, ids, onChange, children }: {
  selected: string[]; ids: string[]; onChange: (checked: boolean) => void; children: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const state = selectionState(selected, ids);
  useEffect(() => { if (input.current) input.current.indeterminate = state.partial; }, [state.partial]);
  return <label className="skill-selection-checkbox">
    <input ref={input} type="checkbox" checked={state.checked} disabled={!ids.length}
      onChange={(e) => onChange(e.target.checked)} />
    <span>{children}</span>
  </label>;
}

type Tab =
  "home" | "library" | "papers" | "assistant" | "projects" | "tools" | "audit";
type Status = {
  ai: boolean;
  aiProvider?: string | null;
  aiModel?: string | null;
  isFreeTier?: boolean;
  freeTierModels?: string[];
  availableModels?: {
    id: string;
    name: string;
    provider?: string;
    tier?: string;
    isDefault?: boolean;
    requiresCredit?: boolean;
    description?: string;
  }[];
  experiential?: {
    configured: boolean;
    provider: string;
    decisionModel: string;
    description: string;
  };
  authConfigured: boolean;
  authenticated: boolean;
  cloudStorage: boolean;
  durableQuota: boolean;
  storage: string;
};
const navigation = [
  ["home", "Tổng quan", LayoutDashboard],
  ["library", "Thư viện kỹ năng", LibraryBig],
  ["papers", "Khám phá bài báo", Globe2],
  ["assistant", "Trợ lý nghiên cứu", Sparkles],
  ["projects", "Dự án của tôi", FolderKanban],
  ["tools", "Công cụ phân tích", Beaker],
  ["audit", "Audit & mã nguồn", ShieldCheck],
] as const;
const formatNumber = (value: number | null) =>
  value === null
    ? "—"
    : Number.isInteger(value)
      ? value.toLocaleString("vi")
      : value.toLocaleString("vi", { maximumFractionDigits: 4 });
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fileUrl(file: string) {
  return "/library/" + file.split("/").map(encodeURIComponent).join("/");
}
function Markdown({
  text,
  file = "",
  openFile,
  openSource,
}: {
  text: string;
  file?: string;
  openFile?: (f: string) => void;
  openSource?: (location: SourceLocation) => void;
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const link = href || "";
            const url =
              file && !/^(https?:|#|mailto:)/.test(link)
                ? new URL(link, `https://local.invalid/library/${file}`)
                    .pathname
                : link;
            return (
              <a
                href={url}
                target={url.startsWith("https:") ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (url.startsWith("#source/") && openSource) {
                    e.preventDefault();
                    const [, documentId, unitId] = url.split("/");
                    openSource({ documentId, unitId });
                    return;
                  }
                  if (
                    url.startsWith("/library/") &&
                    /\.md(?:#.*)?$/.test(url) &&
                    openFile
                  ) {
                    e.preventDefault();
                    openFile(decodeURIComponent(url.slice(9).split("#")[0]));
                  }
                }}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            const source = typeof src === "string" ? src : "";
            if (/^https?:/.test(source))
              return <span>[Ảnh bên ngoài: {alt}]</span>;
            return (
              <img
                src={
                  file
                    ? new URL(source, `https://local.invalid/library/${file}`)
                        .pathname
                    : source
                }
                alt={alt || ""}
                loading="lazy"
              />
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function Workspace() {
  const [tab, setTab] = useState<Tab>("home");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [family, setFamily] = useState("all");
  const [includeRelated, setIncludeRelated] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [docPath, setDocPath] = useState("");
  const [doc, setDoc] = useState("");
  const [docLoading, setDocLoading] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [config, setConfig] = useState(false);
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [paperQuery, setPaperQuery] = useState("");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [paperTotal, setPaperTotal] = useState<number | null>(null);
  const [paperBusy, setPaperBusy] = useState(false);
  const [paperError, setPaperError] = useState("");
  const [chat, setChat] = useState<ChatMessageItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [sourceDocuments, setSourceDocuments] = useState<StoredDocument[]>([]);
  const [enabledDocuments, setEnabledDocuments] = useState<string[]>([]);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceLocation, setSourceLocation] = useState<SourceLocation | null>(null);
  const [prompt, setPrompt] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<"vi" | "en" | "zh">("vi");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [customExpKey, setCustomExpKey] = useState("");
  const [customAiKey, setCustomAiKey] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [keySavedNotice, setKeySavedNotice] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    provider: string;
    status: "success" | "error";
    latencyMs: number;
    message: string;
    models?: string[];
  }> | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCustomExpKey(localStorage.getItem("custom_exp_key") || "");
      setCustomAiKey(localStorage.getItem("custom_ai_key") || "");
      setCustomBaseUrl(localStorage.getItem("custom_base_url") || "");
    }
  }, []);

  const handleSaveApiKeys = () => {
    let cleanedUrl = customBaseUrl.trim();
    cleanedUrl = cleanedUrl.replace(/\/decisions\/?$/, "");
    cleanedUrl = cleanedUrl.replace(/\/chat\/completions\/?$/, "");
    cleanedUrl = cleanedUrl.replace(/\/models\/?$/, "");
    cleanedUrl = cleanedUrl.replace(/\/+$/, "");
    setCustomBaseUrl(cleanedUrl);

    if (typeof window !== "undefined") {
      localStorage.setItem("custom_exp_key", customExpKey.trim());
      localStorage.setItem("custom_ai_key", customAiKey.trim());
      localStorage.setItem("custom_base_url", cleanedUrl);
    }
    setSaveSuccessNotice("Đã lưu toàn bộ cấu hình API Keys thành công!");
    setTimeout(() => setSaveSuccessNotice(""), 4000);
  };

  const handleTestConnection = async () => {
    setTestLoading(true);
    setTestResults(null);
    try {
      let cleanedUrl = customBaseUrl.trim();
      cleanedUrl = cleanedUrl.replace(/\/decisions\/?$/, "");
      cleanedUrl = cleanedUrl.replace(/\/chat\/completions\/?$/, "");
      cleanedUrl = cleanedUrl.replace(/\/models\/?$/, "");
      cleanedUrl = cleanedUrl.replace(/\/+$/, "");
      setCustomBaseUrl(cleanedUrl);

      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expKey: customExpKey.trim(),
          aiKey: customAiKey.trim(),
          baseUrl: cleanedUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kiểm tra thất bại.");
      setTestResults(data.results || []);
    } catch (err: any) {
      setTestResults([
        {
          provider: "Kiểm tra kết nối",
          status: "error",
          latencyMs: 0,
          message: err?.message || "Lỗi kiểm tra kết nối.",
        },
      ]);
    } finally {
      setTestLoading(false);
    }
  };
  const [lastContext, setLastContext] = useState<SkillContextInfo | null>(null);
  const [analysis, setAnalysis] = useState<ReturnType<typeof describe> | null>(
    null,
  );
  const [csvName, setCsvName] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [toolError, setToolError] = useState("");
  const [dna, setDna] = useState("");
  const [dnaResult, setDnaResult] = useState<ReturnType<
    typeof sequenceStats
  > | null>(null);
  const [decisionInput, setDecisionInput] = useState("");
  const [decisionMode, setDecisionMode] = useState<"safety" | "hypothesis" | "review">("safety");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [decisionResult, setDecisionResult] = useState<{
    model: string;
    provider: string;
    answers: Array<{
      type: string;
      name: string;
      choice?: string;
      probabilities?: Array<{ value: string; probability: number }>;
      confidence?: number;
    }>;
    usage?: { total_tokens: number; cost: number };
    evaluatedAt: string;
  } | null>(null);

  const runDecisionEvaluation = async (customInput?: string, customMode?: "safety" | "hypothesis" | "review") => {
    const textToEvaluate = customInput || decisionInput;
    const modeToEvaluate = customMode || decisionMode;
    if (!textToEvaluate.trim()) {
      setDecisionError("Vui lòng nhập nội dung đề xuất hoặc giả thuyết cần thẩm định.");
      return;
    }
    setDecisionBusy(true);
    setDecisionError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customExpKey) headers["x-experiential-key"] = customExpKey;

      const res = await fetch("/api/decisions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          input: textToEvaluate.trim(),
          mode: modeToEvaluate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thẩm định thất bại.");
      setDecisionResult(data);
    } catch (err: any) {
      setDecisionError(err?.message || "Không thể thực hiện thẩm định.");
    } finally {
      setDecisionBusy(false);
    }
  };
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [filePage, setFilePage] = useState(0);
  const importInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const current = projects.find((p) => p.id === projectId);
  const refreshStatus = async () => {
    const r = await fetch("/api/status");
    if (r.ok) {
      const data: Status = await r.json();
      setStatus(data);
      if (data.aiModel) {
        setSelectedModel((prev) => {
          if (!prev) return data.aiModel || "deepseek-v4.1-flash";
          const currentInfo = data.availableModels?.find((m) => m.id === prev);
          if (data.isFreeTier && currentInfo && currentInfo.tier === "paid") {
            return data.aiModel || "deepseek-v4.1-flash";
          }
          return prev;
        });
      }
    }
  };
  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("research_agent_language");
      if (savedLang === "vi" || savedLang === "en" || savedLang === "zh") {
        setSelectedLanguage(savedLang);
      }
    } catch {}
  }, []);

  const changeLanguage = (lang: "vi" | "en" | "zh") => {
    setSelectedLanguage(lang);
    try {
      localStorage.setItem("research_agent_language", lang);
    } catch {}
  };

  useEffect(() => {
    try {
      const current = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
      const saved = localStorage.getItem("research_agent_theme") as "light" | "dark" | null;
      const initialTheme = current || saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    } catch {}
  }, []);

  const toggleTheme = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    try {
      localStorage.setItem("research_agent_theme", newTheme);
    } catch {}
  };

  useEffect(() => {
    loadChatSessions().then((sessions) => {
      setHistorySessions(sessions);
      if (sessions.length > 0) {
        const latest = sessions[0];
        setCurrentSessionId(latest.id);
        setChat(latest.messages);
        if (latest.model) {
          const isKnownPaid = ["deepseek-v4.1-flash-fast", "gemini-3.8-flash-high", "claude-opus-4-6", "kimi-k2.6", "kimi-k3"].includes(latest.model);
          setSelectedModel(isKnownPaid ? "deepseek-v4.1-flash" : latest.model);
        }
        if (latest.language) setSelectedLanguage(latest.language);
      }
    }).catch(() => {});
  }, []);

  const startNewChat = () => {
    const newId = `session-${Date.now()}`;
    setCurrentSessionId(newId);
    setChat([]);
    setLastContext(null);
    setChatError("");
  };

  const restoreSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setChat(session.messages);
    if (session.model) {
      const isKnownPaid = ["deepseek-v4.1-flash-fast", "gemini-3.8-flash-high", "claude-opus-4-6", "kimi-k2.6", "kimi-k3"].includes(session.model);
      setSelectedModel(isKnownPaid ? "deepseek-v4.1-flash" : session.model);
    }
    if (session.language) setSelectedLanguage(session.language);
    setShowHistoryModal(false);
  };

  const removeSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteChatSession(id);
    setHistorySessions((prev) => prev.filter((s) => s.id !== id));
    if (id === currentSessionId) {
      startNewChat();
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Anh có chắc muốn xóa toàn bộ lịch sử các cuộc trò chuyện đã lưu?")) return;
    await clearAllChatSessions();
    setHistorySessions([]);
    startNewChat();
    setShowHistoryModal(false);
  };

  const [exportingDocx, setExportingDocx] = useState(false);

  const handleExportWord = async (sessionToExport?: ChatSession) => {
    const session = sessionToExport || historySessions.find((s) => s.id === currentSessionId) || {
      id: currentSessionId,
      title: prompt.trim().slice(0, 50) || "Hội thoại nghiên cứu",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: selectedModel || status?.aiModel || "deepseek-v4.1-flash",
      language: selectedLanguage,
      messages: chat,
      documentNames: sourceDocuments.filter((d) => enabledDocuments.includes(d.id)).map((d) => d.name),
    };

    if (!session.messages.length) return;
    setExportingDocx(true);
    try {
      const blob = await generateScientificWordDocument(session);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (session.title || "Bao_cao_nghien_cuu")
        .replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, "_")
        .slice(0, 40);
      a.download = `BAO_CAO_NGHIEN_CUU_${safeTitle}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("Không thể xuất file Word: " + (e?.message || "Lỗi không xác định"));
    } finally {
      setExportingDocx(false);
    }
  };

  const handleExportPdf = (sessionToExport?: ChatSession) => {
    const session = sessionToExport || historySessions.find((s) => s.id === currentSessionId) || {
      id: currentSessionId,
      title: prompt.trim().slice(0, 50) || "Hội thoại nghiên cứu",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: selectedModel || status?.aiModel || "deepseek-v4.1-flash",
      language: selectedLanguage,
      messages: chat,
      documentNames: sourceDocuments.filter((d) => enabledDocuments.includes(d.id)).map((d) => d.name),
    };

    if (!session.messages.length) return;
    openScientificPdfPrintView(session);
  };
  useEffect(() => {
    loadDocuments().then((documents) => {
      setSourceDocuments(documents);
      setEnabledDocuments(documents.map((document) => document.id));
    }).catch(() => setError("Không tải được tài liệu lưu trong trình duyệt. Các chức năng khác vẫn dùng được."));
    Promise.all([
      fetch("/catalog.json").then((r) => {
        if (!r.ok) throw Error("Không tải được thư viện.");
        return r.json();
      }),
      fetch("/files.json").then((r) => r.json()),
      fetch("/audit/summary.json").then((r) => r.json()),
    ])
      .then(([c, f, s]) => {
        setCatalog(c);
        setFiles(f);
        setSummary(s);
      })
      .catch((e) => setError(String(e.message)));
    refreshStatus().catch(() => setError("Không lấy được trạng thái máy chủ."));
    try {
      const saved = localStorage.getItem("research-projects");
      if (saved) {
        const result = projectsSchema.safeParse(JSON.parse(saved));
        if (result.success) {
          setProjects(result.data);
          setProjectId(result.data[0]?.id || "");
        } else setError("Dữ liệu dự án lưu trước đó không hợp lệ.");
      }
      const stars = JSON.parse(
        localStorage.getItem("research-favorites") || "[]",
      );
      if (Array.isArray(stars))
        setFavorites(stars.filter((x) => typeof x === "string"));
    } catch {
      setError(
        "Không thể đọc dữ liệu trình duyệt. Hãy kiểm tra quyền lưu trữ.",
      );
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem("research-projects", JSON.stringify(projects));
      } catch {
        setError("Bộ nhớ trình duyệt đã đầy. Hãy xuất dự án để sao lưu.");
      }
  }, [projects, hydrated]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem("research-favorites", JSON.stringify(favorites));
      } catch {}
  }, [favorites, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!docPath) return;
    const controller = new AbortController();
    setDocLoading(true);
    setDoc("");
    fetch(fileUrl(docPath), { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("Không tìm thấy tài liệu.");
        const text = await r.text();
        if (text.length > 2_000_000)
          throw Error("File quá lớn để xem trước. Hãy tải bản gốc.");
        setDoc(text);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setDoc("Lỗi: " + e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocLoading(false);
      });
    return () => controller.abort();
  }, [docPath]);
  useEffect(() => {
    if (!docPath && !config) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDocPath("");
        setConfig(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [docPath, config]);
  const go = (value: Tab) => {
    setTab(value);
    setMobile(false);
  };
  const toggleSkill = (id: string) =>
    setSelected((prev) => selectSkills(prev, [id], !prev.includes(id)));
  const selectScope = (ids: string[], checked: boolean) =>
    setSelected((prev) => selectSkills(prev, ids, checked));
  const star = (id: string) =>
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const updateProject = (patch: Partial<Project>) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, ...patch, updated: new Date().toISOString() }
          : p,
      ),
    );
  const createProject = () => {
    const p: Project = {
      id: crypto.randomUUID(),
      title: "Dự án nghiên cứu mới",
      notes: "",
      skills: [...selected],
      papers: [],
      updated: new Date().toISOString(),
    };
    setProjects((prev) => [p, ...prev]);
    setProjectId(p.id);
    go("projects");
  };
  const savePaper = (paper: Paper) => {
    if (!current) {
      setToast("Tạo hoặc chọn dự án trước khi lưu bài báo.");
      go("projects");
      return;
    }
    if (current.papers.some((p) => p.id === paper.id)) {
      setToast("Bài báo đã có trong dự án.");
      return;
    }
    updateProject({ papers: [...current.papers, paper] });
    setToast("Đã lưu bài báo vào " + current.title);
  };
  const searchPapers = async (e: FormEvent) => {
    e.preventDefault();
    setPaperBusy(true);
    setPaperError("");
    try {
      const res = await fetch(
        "/api/papers?q=" + encodeURIComponent(paperQuery),
      );
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setPapers(data.results);
      setPaperTotal(data.total);
    } catch (e) {
      setPaperError(e instanceof Error ? e.message : "Không thể tìm kiếm.");
    } finally {
      setPaperBusy(false);
    }
  };
  const sendChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || chatBusy || sourceBusy) return;
    const now = new Date().toISOString();
    const next: ChatMessageItem[] = [...chat, { role: "user", content: prompt.trim(), timestamp: now }];
    setChat(next);
    setPrompt("");
    setChatBusy(true);
    setChatError("");

    // Lưu ngay câu hỏi của người dùng vào phiên hiện tại
    const docNames = sourceDocuments.filter((d) => enabledDocuments.includes(d.id)).map((d) => d.name);
    const existingSession = historySessions.find((s) => s.id === currentSessionId);
    const title = existingSession
      ? existingSession.title
      : prompt.trim().slice(0, 60) + (prompt.trim().length > 60 ? "…" : "");
    const inProgressSession: ChatSession = {
      id: currentSessionId,
      title,
      createdAt: existingSession ? existingSession.createdAt : now,
      updatedAt: now,
      model: selectedModel || status?.aiModel || "deepseek-v4.1-flash",
      language: selectedLanguage,
      messages: next,
      documentNames: docNames,
    };
    void saveChatSession(inProgressSession);
    setHistorySessions((prev) => [inProgressSession, ...prev.filter((s) => s.id !== currentSessionId)]);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customExpKey) headers["x-experiential-key"] = customExpKey;
      if (customAiKey) headers["x-ai-key"] = customAiKey;
      if (customBaseUrl) headers["x-ai-base-url"] = customBaseUrl;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          skills: selected,
          model: selectedModel || undefined,
          language: selectedLanguage,
          documents: selectDocumentEvidence(sourceDocuments.filter((document) => enabledDocuments.includes(document.id)), next.slice(-4).filter((message) => message.role === "user").map((message) => message.content).join("\n")),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      const aiTime = new Date().toISOString();
      const fullMessages: ChatMessageItem[] = [
        ...next,
        { role: "assistant", content: data.answer, timestamp: aiTime, evidence: data.evidence },
      ];
      setChat(fullMessages);
      setLastContext(data.context || null);

      // Cập nhật phiên chat hoàn chỉnh có phản hồi của AI
      const completedSession: ChatSession = {
        ...inProgressSession,
        updatedAt: aiTime,
        messages: fullMessages,
      };
      void saveChatSession(completedSession);
      setHistorySessions((prev) => [completedSession, ...prev.filter((s) => s.id !== currentSessionId)]);
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Không thể gọi AI.");
    } finally {
      setChatBusy(false);
    }
  };
  const login = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (password.trim().startsWith("lrsk-")) {
      setLoginError(
        "Đây là API key LarpRouter. Key đã được cấu hình trên máy chủ. Hãy nhập mật khẩu workspace được cấp riêng vào ô này.",
      );
      setPassword("");
      return;
    }
    setLoginBusy(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setPassword("");
      await refreshStatus();
      setConfig(false);
      go("assistant");
      setToast("Đã đăng nhập workspace.");
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Không đăng nhập được.");
    } finally {
      setLoginBusy(false);
    }
  };
  const syncCloud = async () => {
    if (!status?.authenticated) {
      setConfig(true);
      return;
    }
    setSyncBusy(true);
    try {
      const remote = await fetch("/api/projects");
      const data = await remote.json();
      if (!remote.ok) throw Error(data.error);
      const parsed = projectsSchema.parse(data.projects);
      const merged = new Map(parsed.map((p) => [p.id, p]));
      for (const p of projects) {
        const old = merged.get(p.id);
        if (
          !old ||
          new Date(p.updated).getTime() >= new Date(old.updated).getTime()
        )
          merged.set(p.id, p);
      }
      const combined = projectsSchema.parse(
        [...merged.values()].sort((a, b) => b.updated.localeCompare(a.updated)),
      );
      const saved = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: data.revision, projects: combined }),
      });
      const result = await saved.json();
      if (!saved.ok) throw Error(result.error);
      setProjects(combined);
      if (!projectId) setProjectId(combined[0]?.id || "");
      setToast("Đã hợp nhất và lưu dự án trên đám mây.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Đồng bộ không thành công.");
    } finally {
      setSyncBusy(false);
    }
  };
  const readCsv = (file: File) => {
    setToolError("");
    if (file.size > 10 * 1024 * 1024) {
      setToolError("Giới hạn file CSV 10 MB.");
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: false,
      complete: (r) => {
        try {
          if (r.errors.length) throw Error(r.errors[0].message);
          setAnalysis(describe(r.data));
          setCsvName(file.name);
        } catch (e) {
          setToolError(e instanceof Error ? e.message : "CSV không hợp lệ.");
        }
      },
      error: (e) => setToolError(e.message),
    });
  };
  const filtered = filterSkills(catalog, {
    query, family, group: category, includeRelated, favoritesOnly, favorites,
  });
  const visibleGroups = catalog?.groups.filter((g) => family === "all" || g.family === family) || [];
  const chooseGroup = (id: string) => {
    setCategory(id);
    if (id !== "all") setFamily(catalog?.groups.find((g) => g.id === id)?.family || "all");
  };
  const resetLibrary = () => {
    setQuery(""); setFamily("all"); setCategory("all");
    setFavoritesOnly(false); setIncludeRelated(false);
  };
  const filteredFiles = files.filter((f) =>
    f.toLowerCase().includes(fileQuery.toLowerCase()),
  );
  const skillCard = (s: Skill) => (
    <article className="skill-card" key={s.id}>
      <div className="card-top">
        <span className="skill-icon">
          <ScienceIcon icon={catalog?.groups.find((g) => g.id === s.groupId)?.icon} />
        </span>
        <button
          className={
            "icon-button " + (favorites.includes(s.id) ? "starred" : "")
          }
          onClick={() => star(s.id)}
          title="Lưu yêu thích"
          aria-label={"Yêu thích " + s.title}
        >
          <Star
            size={18}
            fill={favorites.includes(s.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <span className="eyebrow category-label">{s.category}</span>
      <h3>{s.title.replace(/[*`]/g, "")}</h3>
      <p className="skill-description">{s.description}</p>
      <details className="classification-details">
        <summary>Phân loại{Boolean(s.relatedGroupIds.length) && " · Liên ngành"}</summary>
        <p>{s.classificationReason}</p>
        {Boolean(s.relatedGroupIds.length) && <div className="related-fields">
          <span>Liên quan:</span>
          {s.relatedGroupIds.map((id) => <button key={id} onClick={() => {
            chooseGroup(id); setIncludeRelated(true); go("library");
          }}>{catalog?.groups.find((g) => g.id === id)?.label}</button>)}
        </div>}
      </details>
      <div className="skill-meta">
        <span>
          <Files size={13} />
          {s.files.length} tệp
        </span>
        <span>
          <FileCode2 size={13} />
          {s.scripts} script
        </span>
      </div>
      <div className="card-actions">
        <button onClick={() => setDocPath(`skills/${s.id}/SKILL.md`)}>
          Khám phá <ArrowRight size={15} />
        </button>
        <button
          className={"pick " + (selected.includes(s.id) ? "picked" : "")}
          onClick={() => toggleSkill(s.id)}
          aria-pressed={selected.includes(s.id)}
          aria-label={(selected.includes(s.id) ? "Bỏ chọn " : "Chọn ") + s.title}
        >
          {selected.includes(s.id) ? <Check size={17} /> : <Plus size={17} />}
        </button>
      </div>
    </article>
  );

  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-scrim" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("home");
          }}
        >
          <span className="brand-mark">
            <FlaskConical size={23} />
          </span>
          <span>
            Research<span className="brand-light">Agent</span>
            <small>KHÔNG GIAN KHOA HỌC</small>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">R</span>
          <div>
            Workspace cá nhân<small>Scientific workspace</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="nav-label">KHÁM PHÁ & NGHIÊN CỨU</span>
        <nav>
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={tab === id ? "active" : ""}
            >
              <Icon size={19} />
              {label}
              {id === "library" && (
                <span className="nav-count">
                  {catalog?.skills.length || "…"}
                </span>
              )}
              {id === "assistant" && <span className="tiny-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-card">
            <div>
              <span className="live-dot" /> THƯ VIỆN MỞ
            </div>
            <p>
              Tri thức khoa học,
              <br />
              sẵn sàng khám phá.
            </p>
            <a
              href="https://github.com/mrbit4578/nghiencuu-khoahoc-agent"
              target="_blank"
              rel="noreferrer"
            >
              Mã nguồn GitHub <ExternalLink size={13} />
            </a>
          </div>
          <button className="settings-link" onClick={() => setConfig(true)}>
            <Settings2 size={18} />
            Cấu hình workspace
          </button>
          <div className="profile">
            <span>NC</span>
            <div>
              Nhà nghiên cứu<small>Dữ liệu lưu trên trình duyệt</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobile(true)}
            aria-label="Mở điều hướng"
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{navigation.find((n) => n[0] === tab)?.[1]}</strong>
          </div>
          <div className="topbar-right">
            <div className="theme-toggle-group" role="radiogroup" aria-label="Chế độ giao diện sáng / tối">
              <button
                type="button"
                className={`theme-pill-btn ${theme === "light" ? "active" : ""}`}
                onClick={() => toggleTheme("light")}
                title="Chế độ nền Sáng (Light Mode)"
                aria-label="Chế độ nền Sáng"
              >
                <Sun size={15} />
                <span>Sáng</span>
              </button>
              <button
                type="button"
                className={`theme-pill-btn ${theme === "dark" ? "active" : ""}`}
                onClick={() => toggleTheme("dark")}
                title="Chế độ nền Tối dịu mắt, độ tương phản cao chống mỏi mắt (Dark Mode)"
                aria-label="Chế độ nền Tối"
              >
                <Moon size={15} />
                <span>Tối</span>
              </button>
            </div>
            <span className="connection">
              <span className="live-dot" /> Thư viện{" "}
              {catalog ? "sẵn sàng" : "đang tải"}
            </span>
            <button
              className="icon-button help-button"
              onClick={() => setDocPath("README.md")}
              title="Tài liệu hướng dẫn"
            >
              <CircleHelp size={19} />
            </button>
            <button className="avatar" onClick={() => setConfig(true)}>
              NC
            </button>
          </div>
        </header>
        <main>
          {error && (
            <div className="notice danger" role="alert">
              {error}
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label="Đóng lỗi"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span className="mini-line" /> YOUR NEXT DISCOVERY STARTS
                    HERE
                  </div>
                  <h1>
                    Ý tưởng hôm nay.
                    <br />
                    <span>Khám phá ngày mai.</span>
                  </h1>
                  <p>
                    Một không gian cho tri thức, công cụ và những câu hỏi lớn
                    của bạn.
                  </p>
                </div>
                <button className="button secondary" onClick={createProject}>
                  <Plus size={17} />
                  Tạo dự án mới
                </button>
              </div>
              <section className="hero-panel">
                <div className="hero-copy">
                  <div className="hero-badge">
                    <Sparkles size={13} /> SCIENTIFIC AGENT SKILLS · v
                    {catalog?.version || "2.72.0"}
                  </div>
                  <h2>
                    Từ câu hỏi nghiên cứu
                    <br />
                    đến bước tiến tiếp theo.
                  </h2>
                  <p>
                    Khám phá {catalog?.skills.length || 177} kỹ năng chuyên sâu.
                    Kết nối tài liệu, xây dựng phương pháp và tổ chức hành trình
                    nghiên cứu.
                  </p>
                  <button
                    className="button light"
                    onClick={() => go("library")}
                  >
                    Khám phá thư viện <ArrowRight size={17} />
                  </button>
                  <span className="hero-footnote">
                    Mã nguồn mở · K-Dense · MIT License
                  </span>
                </div>
                <div className="science-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit orbit-three" />
                  <div className="nucleus">
                    <FlaskConical size={48} strokeWidth={1.1} />
                  </div>
                  <span className="orbital-dot dot-one" />
                  <span className="orbital-dot dot-two" />
                  <span className="orbital-dot dot-three" />
                  <span className="art-label art-label-one">RESEARCH</span>
                  <span className="art-label art-label-two">
                    EXPLORE → DISCOVER
                  </span>
                  <span className="art-cross">+</span>
                </div>
              </section>
              <div className="stats-grid">
                {[
                  [
                    String(catalog?.skills.length || 177),
                    "Kỹ năng khoa học",
                    "Tri thức chuyên sâu",
                    LibraryBig,
                  ],
                  [
                    String(catalog?.categories.length || "…"),
                    "Nhóm chuyên môn",
                    "Liên ngành & kết nối",
                    Globe2,
                  ],
                  [
                    (catalog?.fileCount || 2780).toLocaleString("vi"),
                    "Tệp nguồn nguyên bản",
                    "Có danh mục đối chiếu",
                    Files,
                  ],
                  [
                    String(projects.length),
                    "Dự án cá nhân",
                    "Bắt đầu từ một ý tưởng",
                    FolderKanban,
                  ],
                ].map(([value, label, caption, Icon]) => (
                  <div className="stat-card" key={String(label)}>
                    <div>
                      <span className="stat-number">{String(value)}</span>
                      <span className="stat-title">{String(label)}</span>
                      <small>{String(caption)}</small>
                    </div>
                    <span className="stat-icon">
                      <Icon size={21} />
                    </span>
                  </div>
                ))}
              </div>
              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">BẮT ĐẦU HÀNH TRÌNH</span>
                    <h2>Bạn muốn khám phá điều gì?</h2>
                  </div>
                  <button className="text-button" onClick={() => go("library")}>
                    Tất cả kỹ năng <ArrowRight size={16} />
                  </button>
                </div>
                <div className="path-grid">
                  {[
                    [
                      "01",
                      "Tìm hiểu một lĩnh vực",
                      "Từ di truyền học đến vật lý lượng tử, tìm kỹ năng phù hợp với câu hỏi của bạn.",
                      "library",
                      Microscope,
                    ],
                    [
                      "02",
                      "Tìm bằng chứng khoa học",
                      "Tra cứu bài báo thật từ Europe PMC. Lưu trích dẫn và nguồn cho dự án.",
                      "papers",
                      BookOpen,
                    ],
                    [
                      "03",
                      "Phân tích dữ liệu đầu tiên",
                      "Khám phá CSV, thống kê mô tả và phân tích trình tự DNA ngay trên trình duyệt.",
                      "tools",
                      Activity,
                    ],
                  ].map(([num, title, desc, target, Icon]) => (
                    <button
                      className="path-card"
                      key={String(num)}
                      onClick={() => go(target as Tab)}
                    >
                      <div className="path-top">
                        <Icon size={24} />
                        <span>{String(num)}</span>
                      </div>
                      <h3>{String(title)}</h3>
                      <p>{String(desc)}</p>
                      <ArrowRight className="path-arrow" size={18} />
                    </button>
                  ))}
                </div>
              </section>
              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      BỘ CÔNG CỤ CỦA NHÀ NGHIÊN CỨU
                    </span>
                    <h2>Kỹ năng để bắt đầu</h2>
                  </div>
                  <span className="subtle">
                    Đọc tài liệu gốc · Chọn kỹ năng cho AI
                  </span>
                </div>
                <div className="skills-grid">
                  {(
                    catalog?.skills.filter((s) =>
                      [
                        "literature-review",
                        "experimental-design",
                        "exploratory-data-analysis",
                      ].includes(s.id),
                    ) || []
                  ).map(skillCard)}
                </div>
              </section>
              <div className="bottom-note">
                <ShieldCheck size={18} />
                <p>
                  <strong>Minh bạch từ dữ liệu đến kết quả.</strong> Mọi tệp
                  nguồn được giữ nguyên và có SHA-256 đối chiếu. Trợ lý AI cần
                  API key để hoạt động.
                </p>
                <button onClick={() => go("audit")}>
                  Xem audit <ArrowRight size={14} />
                </button>
              </div>
            </>
          )}
          {tab === "library" && (
            <>
              <div className="simple-heading">
                <div className="eyebrow">SCIENTIFIC AGENT SKILLS</div>
                <h1>Thư viện kỹ năng</h1>
                <p>
                  Đọc tài liệu và mã nguồn của toàn bộ{" "}
                  {catalog?.skills.length || 177} kỹ năng. Chọn từng kỹ năng, toàn bộ nhóm
                  hoặc toàn bộ thư viện làm ngữ cảnh cho trợ lý.
                </p>
              </div>
              <section className="science-directory" aria-label="Nhóm khoa học">
                <div className="science-directory-heading">
                  <h2>Khám phá theo nhóm khoa học</h2>
                  <span>{catalog?.groups.length || 12} nhóm · Mỗi kỹ năng có một nhóm chính</span>
                </div>
                <div className="science-families" aria-label="Khối khoa học">
                  <button aria-pressed={family === "all"} onClick={() => { setFamily("all"); setCategory("all"); }}>Tất cả</button>
                  {catalog?.families.map((f) => <button key={f.id} aria-pressed={family === f.id}
                    onClick={() => { setFamily(f.id); setCategory("all"); }}>{f.label}</button>)}
                </div>
                <div className="science-groups">
                  {visibleGroups.map((g) => <button key={g.id} className="science-group"
                    aria-pressed={category === g.id} title={g.description}
                    onClick={() => chooseGroup(category === g.id ? "all" : g.id)}>
                    <span className="science-group-icon"><ScienceIcon icon={g.icon} /></span>
                    <span className="science-group-copy"><strong>{g.label}</strong><small>{g.count} kỹ năng chính</small></span>
                    <ChevronRight size={16} />
                  </button>)}
                </div>
              </section>
              <div className="filter-bar">
                <label className="search-field">
                  <Search size={19} />
                  <input aria-label="Tìm kỹ năng" placeholder="Tìm kỹ năng, công cụ hoặc lĩnh vực (có hoặc không dấu)…"
                    value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <select aria-label="Nhóm khoa học" value={category} onChange={(e) => chooseGroup(e.target.value)}>
                  <option value="all">{family === "all" ? "Tất cả nhóm khoa học" : "Tất cả nhóm trong khối"}</option>
                  {catalog?.families.filter((f) => family === "all" || f.id === family).map((f) =>
                    <optgroup key={f.id} label={f.label}>
                      {catalog.groups.filter((g) => g.family === f.id).map((g) => <option key={g.id} value={g.id}>{g.label} ({g.count})</option>)}
                    </optgroup>)}
                </select>
                <button className={"button secondary " + (favoritesOnly ? "selected" : "")}
                  aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
                  <Star size={16} />Đã lưu ({favorites.length})
                </button>
              </div>
              <div className="taxonomy-options">
                <label><input type="checkbox" checked={includeRelated} onChange={(e) => setIncludeRelated(e.target.checked)} />Bao gồm kỹ năng liên ngành</label>
                <span>Đếm theo nhóm chính; nhãn liên ngành giúp tìm thêm kỹ năng liên quan.</span>
                {(query || family !== "all" || category !== "all" || favoritesOnly || includeRelated) &&
                  <button className="text-button" onClick={resetLibrary}>Xóa bộ lọc</button>}
              </div>
              <div className="bulk-selection-bar" aria-label="Chọn hàng loạt kỹ năng">
                <SkillSelectionCheckbox selected={selected} ids={catalog?.skills.map((s) => s.id) || []}
                  onChange={(checked) => selectScope(catalog?.skills.map((s) => s.id) || [], checked)}>
                  Chọn toàn bộ thư viện ({catalog?.skills.length || 0})
                </SkillSelectionCheckbox>
                <SkillSelectionCheckbox selected={selected} ids={filtered.map((s) => s.id)}
                  onChange={(checked) => selectScope(filtered.map((s) => s.id), checked)}>
                  Chọn tất cả kết quả ({filtered.length})
                </SkillSelectionCheckbox>
                <button className="text-button" disabled={!selected.length} onClick={() => setSelected([])}>Bỏ chọn hết</button>
              </div>
              <div className="results-line" aria-live="polite">
                <span>{filtered.length} kỹ năng phù hợp{includeRelated && (category !== "all" || family !== "all") ? " · gồm liên ngành" : ""}</span>
                <button className="text-button" onClick={() => go("assistant")}>
                  Đã chọn {selected.length}/{catalog?.skills.length || 177} <ArrowRight size={14} />
                </button>
              </div>
              {catalog?.groups.filter((g) => filtered.some((s) => s.groupId === g.id)).map((g) => (
                <section key={g.id} className="science-results" aria-labelledby={"group-" + g.id}>
                  <div className="science-results-heading">
                    <span className="skill-icon"><ScienceIcon icon={g.icon} /></span>
                    <div><h2 id={"group-" + g.id}>{g.label} <span>{filtered.filter((s) => s.groupId === g.id).length}</span></h2><p>{g.description}</p></div>
                    <SkillSelectionCheckbox selected={selected} ids={catalog.skills.filter((s) => s.groupId === g.id).map((s) => s.id)}
                      onChange={(checked) => selectScope(catalog.skills.filter((s) => s.groupId === g.id).map((s) => s.id), checked)}>
                      Chọn toàn nhóm ({g.count})
                    </SkillSelectionCheckbox>
                  </div>
                  <div className="skills-grid">{filtered.filter((s) => s.groupId === g.id).map(skillCard)}</div>
                </section>
              ))}
              {!filtered.length && (
                <div className="empty-state">
                  <Search size={32} /><h3>Chưa tìm thấy kỹ năng</h3>
                  <p>Thử từ khóa khác, bật liên ngành hoặc xóa bộ lọc.</p>
                  <button className="button secondary" onClick={resetLibrary}>Xóa bộ lọc</button>
                </div>
              )}
            </>
          )}
          {tab === "papers" && (
            <>
              <div className="simple-heading">
                <div className="eyebrow">EVIDENCE BEFORE ANSWERS</div>
                <h1>Khám phá bài báo</h1>
                <p>
                  Tìm tài liệu khoa học từ Europe PMC. Kết quả đến từ API thật,
                  kèm DOI và nguồn xuất bản.
                </p>
              </div>
              <form className="paper-search" onSubmit={searchPapers}>
                <Search size={21} />
                <input
                  aria-label="Tìm bài báo"
                  placeholder="Ví dụ: CRISPR cancer therapy, single-cell RNA sequencing…"
                  minLength={3}
                  maxLength={300}
                  required
                  value={paperQuery}
                  onChange={(e) => setPaperQuery(e.target.value)}
                />
                <button className="button primary" disabled={paperBusy}>
                  {paperBusy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <Search size={17} />
                  )}
                  Tìm kiếm
                </button>
              </form>
              <div className="results-line">
                <span>
                  {paperTotal !== null
                    ? `${paperTotal.toLocaleString("vi")} kết quả · hiển thị ${papers.length} bài đầu tiên`
                    : "Nguồn dữ liệu: Europe PMC · Y sinh & khoa học sự sống"}
                </span>
                <select
                  aria-label="Dự án lưu bài báo"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Chọn dự án để lưu bài</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              {paperError && (
                <div role="alert" className="notice danger">
                  {paperError}
                </div>
              )}
              <div className="paper-list">
                {papers.map((p) => (
                  <article className="paper-card" key={p.id}>
                    <div className="paper-labels">
                      <span>{p.year || "Chưa rõ năm"}</span>
                      {p.openAccess && (
                        <span className="badge green">Truy cập mở</span>
                      )}
                      <span>{p.citations} lượt trích dẫn</span>
                    </div>
                    <h2>
                      <a href={p.url} target="_blank" rel="noreferrer">
                        {p.title}
                        <ExternalLink size={15} />
                      </a>
                    </h2>
                    <div className="paper-authors">
                      {p.authors.slice(0, 5).join(", ")}
                      {p.authors.length > 5 ? " và cộng sự" : ""} · {p.venue}
                    </div>
                    <p>
                      {p.abstract ||
                        "Nguồn không cung cấp tóm tắt cho bài báo này."}
                    </p>
                    <div className="paper-bottom">
                      <span>DOI: {p.doi || "Không có trong nguồn"}</span>
                      <button
                        className="button secondary"
                        onClick={() => savePaper(p)}
                      >
                        <Plus size={15} />
                        Lưu vào dự án
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!paperBusy && !papers.length && (
                <div className="empty-state">
                  <BookOpen size={42} />
                  <h3>
                    {paperTotal === 0
                      ? "Không có bài báo phù hợp"
                      : "Bắt đầu với một câu hỏi tốt"}
                  </h3>
                  <p>
                    Nhập từ khóa tiếng Anh để có phạm vi kết quả rộng hơn.
                    <br />
                    Bạn cũng có thể dùng cú pháp Europe PMC như TITLE:CRISPR.
                  </p>
                </div>
              )}
            </>
          )}
          {tab === "assistant" && (
            <>
              <div className="simple-heading">
                <div className="eyebrow">YOUR RESEARCH COMPANION</div>
                <h1>Trợ lý nghiên cứu</h1>
                <p>
                  Đối thoại với AI dựa trên kỹ năng và tài liệu anh tải lên. AI hỗ trợ
                  lập luận và viết mã; không tự thực thi Python.
                </p>
              </div>
              <div className="model-selector-bar">
                <div className="model-badge">
                  <Sparkles size={16} />
                  <span>Mô hình AI:</span>
                </div>
                {status?.availableModels && status.availableModels.length > 0 ? (
                  <select
                    className="model-select"
                    value={selectedModel || status?.aiModel || "deepseek-v4.1-flash"}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    aria-label="Chọn mô hình AI"
                  >
                    <optgroup label="✨ Mô hình Miễn phí (Free Tier - Khuyên dùng)">
                      {status.availableModels
                        .filter((m) => m.tier === "free")
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            ★ {m.name} ({m.provider || "AI"})
                          </option>
                        ))}
                    </optgroup>
                    {status.availableModels.some((m) => m.tier !== "free") && (
                      <optgroup label="💳 Mô hình Trả phí (Cần nạp credit LarpRouter)">
                        {status.availableModels
                          .filter((m) => m.tier !== "free")
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} [Cần credit] ({m.provider || "AI"})
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                ) : (
                  <code className="active-model-name">
                    {selectedModel || status?.aiModel || "deepseek-v4.1-flash"}
                  </code>
                )}
                {status?.isFreeTier && (
                  <span className="free-tier-pill" title="Tài khoản LarpRouter Free Tier: 2 mô hình DeepSeek V4.1 Flash và GLM 5.3 Flash hoạt động 100% miễn phí">
                    ★ Free Tier (DeepSeek & GLM)
                  </span>
                )}
                {status?.availableModels?.find((m) => m.id === selectedModel)?.tier === "paid" && (
                  <span className="paid-warning-pill" title="Mô hình này yêu cầu tài khoản trả phí có credit. Hệ thống sẽ tự động fallback sang DeepSeek V4.1 Flash nếu tài khoản chưa nạp credit.">
                    ⚠️ Cần credit (Tự động fallback Free tier)
                  </span>
                )}
                {status?.aiProvider && (
                  <span className="provider-pill">Đấu nối: {status.aiProvider}</span>
                )}
                {status?.experiential?.configured && (
                  <span className="decision-pill" title="Mô hình OpenAI GPT-6 Luna Decisions đã sẵn sàng thẩm định xác suất">
                    ⚡ GPT-6 Luna Decisions
                  </span>
                )}
                <div className="language-selector-group">
                  <div className="model-badge">
                    <Globe2 size={16} />
                    <span className="lang-label">Ngôn ngữ:</span>
                  </div>
                  <div className="language-pills" role="radiogroup" aria-label="Ngôn ngữ phản hồi">
                    <button
                      type="button"
                      className={`lang-pill-btn ${selectedLanguage === "vi" ? "active" : ""}`}
                      onClick={() => changeLanguage("vi")}
                      title="Mặc định: Bắt buộc trả lời 100% bằng Tiếng Việt"
                    >
                      🇻🇳 Tiếng Việt
                    </button>
                    <button
                      type="button"
                      className={`lang-pill-btn ${selectedLanguage === "en" ? "active" : ""}`}
                      onClick={() => changeLanguage("en")}
                      title="Chuyển sang trả lời bằng tiếng Anh (English)"
                    >
                      🇬🇧 English
                    </button>
                    <button
                      type="button"
                      className={`lang-pill-btn ${selectedLanguage === "zh" ? "active" : ""}`}
                      onClick={() => changeLanguage("zh")}
                      title="Chuyển sang trả lời bằng tiếng Trung (中文)"
                    >
                      🇨🇳 中文
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="history-trigger-btn"
                  onClick={() => setShowHistoryModal(true)}
                  title="Xem và quản lý nhật ký các phiên đối thoại đã lưu"
                >
                  <History size={15} />
                  <span>Nhật ký chat ({historySessions.length})</span>
                </button>
              </div>
              <ResearchSources documents={sourceDocuments} enabled={enabledDocuments} onDocuments={setSourceDocuments}
                onEnabled={setEnabledDocuments} onView={setSourceLocation} onBusy={setSourceBusy} query={prompt || chat.filter((message) => message.role === "user").at(-1)?.content || ""} />
              <div className="chat-layout">
                <div className="chat-main">
                  <div className="chat-messages" aria-live="polite">
                    {!chat.length && (
                      <div className="chat-welcome">
                        <span className="welcome-icon">
                          <Sparkles size={28} />
                        </span>
                        <h2>Cùng làm rõ câu hỏi của bạn.</h2>
                        <p>
                          Chọn kỹ năng bên phải, rồi bắt đầu từ mục tiêu, dữ
                          liệu hoặc một vấn đề cần giải quyết.
                        </p>
                        <div className="prompt-grid">
                          {[
                            "Giúp tôi thiết kế một nghiên cứu có thể tái lập.",
                            "Lập kế hoạch tổng quan tài liệu theo PRISMA.",
                            "Giải thích cách chọn phép kiểm định thống kê.",
                          ].map((p) => (
                            <button key={p} onClick={() => setPrompt(p)}>
                              {p}
                              <ArrowRight size={14} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {chat.map((m, i) => (
                      <article key={i} className={"message " + m.role}>
                        <strong>
                          {m.role === "user" ? "Bạn" : "Research Agent"}
                        </strong>
                        <Markdown text={m.content} openSource={(location) => {
                          if (sourceDocuments.some((document) => document.id === location.documentId)) setSourceLocation(location);
                          else setToast("Tài liệu nguồn đã được xóa hoặc không có trên trình duyệt này.");
                        }} />
                        {m.evidence && m.evidence.documents > 0 && <div className="answer-sources">
                          <strong>Căn cứ đã gửi: {m.evidence.documents} file · {m.evidence.includedUnits}/{m.evidence.totalUnits} đoạn</strong>
                          {m.evidence.sources.map((source) => <button className="text-button" key={source.id} onClick={() => {
                            if (sourceDocuments.some((document) => document.id === source.id)) setSourceLocation({ documentId: source.id, unitId: source.units[0]?.id });
                            else setToast("Tài liệu nguồn không còn trong thư viện của trình duyệt này.");
                          }}>{source.name}</button>)}
                        </div>}
                      </article>
                    ))}
                    {chatBusy && (
                      <div className="thinking">
                        <LoaderCircle className="spin" size={17} />
                        Đang phân tích câu hỏi…
                      </div>
                    )}
                  </div>
                  {(!status?.ai || !status.authenticated) && (
                    <div className="notice">
                      {!status?.ai
                        ? "Chưa kích hoạt AI. Thêm API key và cấu hình xác thực trong Vercel để bắt đầu."
                        : "Đăng nhập workspace để sử dụng trợ lý."}
                      <button
                        className="text-button"
                        onClick={() => setConfig(true)}
                      >
                        Cấu hình <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                  {chatError && (
                    <div className="notice danger" role="alert">
                      {chatError}
                    </div>
                  )}
                  <form className="chat-composer" onSubmit={sendChat}>
                    <textarea
                      aria-label="Câu hỏi cho trợ lý"
                      placeholder="Mô tả câu hỏi, dữ liệu và điều bạn muốn tìm hiểu…"
                      maxLength={12000}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                    />
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
                      <span>
                        Trả lời: <strong>{selectedLanguage === "vi" ? "🇻🇳 Tiếng Việt" : selectedLanguage === "en" ? "🇬🇧 English" : "🇨🇳 中文"}</strong> · Kiểm chứng độc lập mọi kết quả và trích dẫn.
                      </span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        {prompt.trim() && (
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => {
                              setDecisionMode("safety");
                              setDecisionInput(prompt);
                              setTab("tools");
                              setTimeout(() => {
                                const el = document.querySelector(".decision-card");
                                el?.scrollIntoView({ behavior: "smooth" });
                              }, 150);
                            }}
                            title="Thẩm định xác suất độ an toàn hoặc tính khả thi của đề xuất này bằng GPT-6 Luna Decisions"
                          >
                            ⚡ Thẩm định GPT-6 Luna
                          </button>
                        )}
                        <button
                          className="button primary"
                          disabled={
                            !status?.ai ||
                            !status.authenticated ||
                            chatBusy ||
                            sourceBusy ||
                            !prompt.trim()
                          }
                        >
                          <Send size={16} />
                          {sourceBusy ? "Đang đọc tài liệu…" : "Gửi câu hỏi"}
                        </button>
                      </div>
                    </div>
                  </form>
                  <div className="chat-footer">
                    <button
                      className="text-button"
                      onClick={startNewChat}
                      disabled={chatBusy}
                    >
                      <Plus size={14} /> Cuộc trò chuyện mới
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setShowHistoryModal(true)}
                    >
                      <History size={14} /> Xem nhật ký chat ({historySessions.length})
                    </button>
                    <div className="export-btn-group" role="group" aria-label="Tùy chọn xuất báo cáo khoa học">
                      <button
                        className="text-button export-action-btn export-word-btn"
                        disabled={!chat.length || exportingDocx}
                        onClick={() => void handleExportWord()}
                        title="Xuất hồ sơ hội thoại ra file Word (.docx) chuẩn báo cáo khoa học (Quốc hiệu, Tiêu đề, Bảng tra cứu bằng chứng, Khối chữ ký)"
                      >
                        <FileText size={14} /> {exportingDocx ? "Đang tạo .docx…" : "Xuất Word (.docx)"}
                      </button>
                      <button
                        className="text-button export-action-btn export-pdf-btn"
                        disabled={!chat.length}
                        onClick={() => handleExportPdf()}
                        title="Mở bản in chuẩn A4 học thuật để in hoặc Lưu dưới dạng PDF vector chất lượng cao"
                      >
                        <Printer size={14} /> Xuất PDF (A4)
                      </button>
                      <button
                        className="text-button export-action-btn"
                        disabled={!chat.length}
                        onClick={() => {
                          const currentSession = historySessions.find((s) => s.id === currentSessionId);
                          if (currentSession) {
                            const md = exportSessionToMarkdown(currentSession);
                            download(`chat-${currentSession.title.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, "_")}.md`, md, "text/markdown");
                          } else {
                            download(
                              "research-conversation.md",
                              chat
                                .map((m) => `## ${m.role === "user" ? "Bạn" : "Research Agent"}\n\n${m.content}`)
                                .join("\n\n"),
                              "text/markdown",
                            );
                          }
                        }}
                        title="Tải về file văn bản Markdown .md"
                      >
                        <ArrowDownToLine size={14} /> Markdown
                      </button>
                    </div>
                  </div>
                </div>
                <aside className="context-panel">
                  <span className="eyebrow">NGỮ CẢNH NGHIÊN CỨU</span>
                  <h3>
                    Kỹ năng đã chọn <span>{selected.length}/{catalog?.skills.length || 177}</span>
                  </h3>
                  <p>
                    Mỗi kỹ năng đã chọn đều được đưa vào ngữ cảnh. Khi chọn nhiều,
                    SKILL.md được trích gọn để phù hợp dung lượng AI; các file tham khảo chưa được nạp tự động.
                  </p>
                  <div className="context-selection-controls">
                    <SkillSelectionCheckbox selected={selected} ids={catalog?.skills.map((s) => s.id) || []}
                      onChange={(checked) => selectScope(catalog?.skills.map((s) => s.id) || [], checked)}>
                      Chọn tất cả ({catalog?.skills.length || 0})
                    </SkillSelectionCheckbox>
                    <button className="text-button" disabled={!selected.length} onClick={() => setSelected([])}>Bỏ chọn hết</button>
                  </div>
                  {lastContext && <p className="context-receipt" role="status">
                    Lần gửi gần nhất: {lastContext.includedCount}/{lastContext.selectedCount} kỹ năng đã gửi
                    {lastContext.excerptedCount > 0 && ` · ${lastContext.excerptedCount} tài liệu trích gọn`}.
                  </p>}
                  <div className="context-skill-list" aria-label="Danh sách kỹ năng đã chọn">
                  {selected.map((id) => (
                    <div className="context-skill" key={id}>
                      <span>
                        {catalog?.skills.find((s) => s.id === id)?.title || id}
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => toggleSkill(id)}
                        aria-label={"Bỏ chọn " + id}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                  </div>
                  <button
                    className="button secondary full"
                    onClick={() => go("library")}
                  >
                    <Plus size={16} />
                    Chọn từ thư viện
                  </button>
                  <div className="context-tip">
                    <ShieldCheck size={20} />
                    <strong>Nghiên cứu có trách nhiệm</strong>
                    <p>
                      AI có thể sai. Luôn đối chiếu bài báo gốc, điều kiện thí
                      nghiệm và giới hạn của phương pháp.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {tab === "projects" && (
            <>
              <div className="simple-heading heading-row">
                <div>
                  <div className="eyebrow">IDEAS INTO KNOWLEDGE</div>
                  <h1>Dự án của tôi</h1>
                  <p>
                    Ghi chú, bài báo và kỹ năng trong cùng một nơi. Dữ liệu được
                    lưu riêng trên trình duyệt này.
                  </p>
                </div>
                <button className="button primary" onClick={createProject}>
                  <Plus size={17} />
                  Tạo dự án
                </button>
              </div>
              <div className="project-toolbar">
                <button
                  className="button secondary"
                  disabled={syncBusy || !status?.cloudStorage}
                  onClick={syncCloud}
                  title="Cần Redis và đăng nhập workspace"
                >
                  {syncBusy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Globe2 size={16} />
                  )}
                  Đồng bộ đám mây
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      "research-projects.json",
                      JSON.stringify(projects, null, 2),
                    )
                  }
                >
                  <ArrowDownToLine size={16} />
                  Sao lưu JSON
                </button>
                <button
                  className="button secondary"
                  onClick={() => importInput.current?.click()}
                >
                  <Upload size={16} />
                  Nhập dự án
                </button>
                <input
                  hidden
                  ref={importInput}
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      if (file.size > 5_000_000)
                        throw Error("Giới hạn nhập 5 MB.");
                      const imported = projectsSchema.parse(
                        JSON.parse(await file.text()),
                      );
                      setProjects((prev) => {
                        const ids = new Set(prev.map((p) => p.id));
                        return [
                          ...prev,
                          ...imported.map((p) =>
                            ids.has(p.id)
                              ? { ...p, id: crypto.randomUUID() }
                              : p,
                          ),
                        ];
                      });
                      setToast("Đã nhập " + imported.length + " dự án.");
                    } catch {
                      setToast(
                        "File dự án không đúng định dạng hoặc vượt giới hạn.",
                      );
                    }
                  }}
                />
              </div>
              {!projects.length ? (
                <div className="empty-state">
                  <FolderKanban size={44} />
                  <h3>Mỗi khám phá bắt đầu từ một dự án.</h3>
                  <p>
                    Tạo không gian cho câu hỏi, phương pháp và tài liệu của bạn.
                  </p>
                  <button className="button primary" onClick={createProject}>
                    <Plus size={17} />
                    Tạo dự án đầu tiên
                  </button>
                </div>
              ) : (
                <div className="projects-layout">
                  <div className="project-list">
                    {projects.map((p) => (
                      <button
                        className={projectId === p.id ? "active" : ""}
                        key={p.id}
                        onClick={() => setProjectId(p.id)}
                      >
                        <FolderKanban size={18} />
                        <div>
                          <strong>{p.title}</strong>
                          <small>
                            {p.papers.length} bài báo · {p.skills.length} kỹ
                            năng
                          </small>
                        </div>
                      </button>
                    ))}
                  </div>
                  {current ? (
                    <div className="project-editor">
                      <label className="field-label">
                        TÊN DỰ ÁN
                        <input
                          className="title-input"
                          maxLength={300}
                          value={current.title}
                          onChange={(e) =>
                            updateProject({
                              title: e.target.value || "Dự án chưa đặt tên",
                            })
                          }
                        />
                      </label>
                      <div className="results-line">
                        <span>
                          Lưu tự động ·{" "}
                          {new Date(current.updated).toLocaleDateString(
                            "vi-VN",
                          )}
                        </span>
                        <button
                          className="text-button danger-text"
                          onClick={() => {
                            if (
                              window.confirm("Xóa dự án này khỏi trình duyệt?")
                            ) {
                              setProjects((prev) =>
                                prev.filter((p) => p.id !== current.id),
                              );
                              setProjectId(
                                projects.find((p) => p.id !== current.id)?.id ||
                                  "",
                              );
                            }
                          }}
                        >
                          <Trash2 size={15} />
                          Xóa dự án
                        </button>
                      </div>
                      <label className="field-label">
                        SỔ TAY NGHIÊN CỨU
                        <textarea
                          className="notes-input"
                          placeholder="Câu hỏi nghiên cứu, giả thuyết, phương pháp, kết quả và bước tiếp theo…"
                          value={current.notes}
                          maxLength={500000}
                          onChange={(e) =>
                            updateProject({ notes: e.target.value })
                          }
                        />
                      </label>
                      <div className="section-heading">
                        <h3>Kỹ năng dự án</h3>
                        <button
                          className="text-button"
                          onClick={() => {
                            updateProject({ skills: [...selected] });
                            setToast("Đã gắn các kỹ năng đang chọn.");
                          }}
                        >
                          <Plus size={14} />
                          Gắn {selected.length} kỹ năng đã chọn
                        </button>
                      </div>
                      <div className="chips">
                        {current.skills.map((id) => (
                          <button
                            key={id}
                            onClick={() => setDocPath(`skills/${id}/SKILL.md`)}
                          >
                            {id}
                            <BookOpen size={13} />
                          </button>
                        ))}
                      </div>
                      <h3>Bài báo đã lưu ({current.papers.length})</h3>
                      {current.papers.map((p) => (
                        <div className="saved-paper" key={p.id}>
                          <a href={p.url} target="_blank" rel="noreferrer">
                            {p.title}
                            <small>
                              {p.year} · {p.doi || p.id}
                            </small>
                          </a>
                          <button
                            className="icon-button"
                            onClick={() =>
                              updateProject({
                                papers: current.papers.filter(
                                  (x) => x.id !== p.id,
                                ),
                              })
                            }
                            aria-label="Bỏ lưu bài báo"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <div className="project-toolbar">
                        <button
                          className="button secondary"
                          onClick={() =>
                            download(
                              "research-notes.md",
                              `# ${current.title}\n\n${current.notes}\n\n## Tài liệu tham khảo\n\n` +
                                current.papers
                                  .map(
                                    (p) =>
                                      `- ${p.authors.join(", ")} (${p.year || "n.d."}). ${p.title}. ${p.url}`,
                                  )
                                  .join("\n"),
                              "text/markdown",
                            )
                          }
                        >
                          <ArrowDownToLine size={16} />
                          Xuất Markdown
                        </button>
                        <button
                          className="button secondary"
                          onClick={() =>
                            download(
                              "references.bib",
                              current.papers
                                .map(
                                  (p, i) =>
                                    `@article{research${i + 1},\n  title = {${p.title.replace(/[{}\\]/g, "")}},\n  author = {${p.authors.join(" and ").replace(/[{}\\]/g, "")}},\n  year = {${p.year || ""}},\n  doi = {${p.doi || ""}}\n}`,
                                )
                                .join("\n\n"),
                              "text/plain",
                            )
                          }
                        >
                          Xuất BibTeX
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-state">
                      Chọn một dự án để tiếp tục.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {tab === "tools" && (
            <>
              <div className="simple-heading">
                <div className="eyebrow">SMALL TOOLS, REAL RESULTS</div>
                <h1>Công cụ phân tích</h1>
                <p>
                  Các phép tính bên dưới chạy thật trên trình duyệt. Dữ liệu
                  không được gửi đến máy chủ.
                </p>
              </div>
              {toolError && (
                <div className="notice danger" role="alert">
                  {toolError}
                </div>
              )}
              <section className="tool-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">01 / EXPLORATORY ANALYSIS</span>
                    <h2>Khám phá dữ liệu CSV</h2>
                  </div>
                  <span className="badge green">Chạy trên trình duyệt</span>
                </div>
                <p>
                  Thống kê mô tả theo cột: số dòng thiếu, giá trị duy nhất,
                  trung bình, trung vị và độ lệch chuẩn mẫu. CSV có tiêu đề, tối
                  đa 10 MB và 100.000 dòng.
                </p>
                <div className="upload-zone">
                  <Upload size={28} />
                  <h3>{csvName || "Chọn dữ liệu của bạn"}</h3>
                  <p>File .csv · Hỗ trợ dấu phẩy và dấu chấm phẩy</p>
                  <button
                    className="button primary"
                    onClick={() => csvInput.current?.click()}
                  >
                    Chọn file CSV
                  </button>
                  <input
                    ref={csvInput}
                    hidden
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) readCsv(f);
                    }}
                  />
                </div>
                {analysis && (
                  <>
                    <div className="results-line">
                      <span>
                        {csvName} · {analysis[0]?.count} dòng ·{" "}
                        {analysis.length} cột
                      </span>
                      <button
                        className="text-button"
                        onClick={() =>
                          download(
                            "descriptive-statistics.json",
                            JSON.stringify(
                              { source: csvName, statistics: analysis },
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        Xuất kết quả <ArrowDownToLine size={15} />
                      </button>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            {[
                              "Cột",
                              "Loại",
                              "Thiếu",
                              "Duy nhất",
                              "Min",
                              "Max",
                              "Trung bình",
                              "Trung vị",
                              "Độ lệch chuẩn",
                            ].map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.map((c) => (
                            <tr key={c.column}>
                              <td>
                                <strong>{c.column}</strong>
                              </td>
                              <td>{c.type}</td>
                              <td>{c.missing}</td>
                              <td>{c.unique}</td>
                              {[
                                c.min,
                                c.max,
                                c.mean,
                                c.median,
                                c.standardDeviation,
                              ].map((n, i) => (
                                <td key={i}>{formatNumber(n)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>

              <section className="tool-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">02 / SEQUENCE ANALYSIS</span>
                    <h2>Phân tích trình tự DNA</h2>
                  </div>
                  <span className="badge green">Chạy trên trình duyệt</span>
                </div>
                <p>
                  Một trình tự DNA hoặc FASTA, tối đa 100.000 ký tự. GC% được
                  tính trên A/C/G/T, loại N khỏi mẫu số.
                </p>
                <textarea
                  className="dna-input"
                  aria-label="Trình tự DNA"
                  placeholder={">my_sequence\nATGCGTACGTAGCTAGCTAGC"}
                  value={dna}
                  maxLength={100000}
                  onChange={(e) => setDna(e.target.value)}
                />
                <button
                  className="button primary"
                  onClick={() => {
                    try {
                      setToolError("");
                      setDnaResult(sequenceStats(dna));
                    } catch (e) {
                      setDnaResult(null);
                      setToolError(
                        e instanceof Error
                          ? e.message
                          : "Trình tự không hợp lệ.",
                      );
                    }
                  }}
                >
                  <Activity size={16} />
                  Phân tích trình tự
                </button>
                {dnaResult && (
                  <div className="dna-results">
                    <div className="mini-stats">
                      <div>
                        <strong>{formatNumber(dnaResult.length)}</strong>
                        <span>Nucleotide</span>
                      </div>
                      <div>
                        <strong>{formatNumber(dnaResult.gcPercent)}%</strong>
                        <span>Hàm lượng GC</span>
                      </div>
                      {Object.entries(dnaResult.counts).map(([key, n]) => (
                        <div key={key}>
                          <strong>{n}</strong>
                          <span>{key}</span>
                        </div>
                      ))}
                    </div>
                    <h3>Chuỗi bổ sung đảo ngược</h3>
                    <pre className="sequence-output">
                      {dnaResult.reverseComplement}
                    </pre>
                    <button
                      className="text-button"
                      onClick={() =>
                        download(
                          "dna-analysis.json",
                          JSON.stringify(dnaResult, null, 2),
                        )
                      }
                    >
                      Xuất kết quả <ArrowDownToLine size={15} />
                    </button>
                  </div>
                )}
              </section>

              <section className="tool-card decision-card">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">03 / DECISION & SAFETY VALIDATION</span>
                    <h2>Thẩm định Quyết định & Giả thuyết (GPT-6 Luna Decisions)</h2>
                  </div>
                  <span className="source-tag">
                    OpenAI · Experiential Labs
                  </span>
                </div>
                <p>
                  Mô hình <strong>GPT-6 Luna Decisions</strong> chuyên biệt cho việc đánh giá
                  xác suất toán học, thẩm định độ tin cậy của giả thuyết khoa học, đề xuất thay đổi hóa chất và độ an toàn quy trình.
                </p>

                <div className="decision-mode-bar">
                  <span className="decision-mode-label">Chế độ thẩm định:</span>
                  <div className="decision-mode-pills">
                    <button
                      type="button"
                      className={`decision-mode-btn ${decisionMode === "safety" ? "active" : ""}`}
                      onClick={() => setDecisionMode("safety")}
                    >
                      🛡️ An toàn hóa chất & quy trình
                    </button>
                    <button
                      type="button"
                      className={`decision-mode-btn ${decisionMode === "hypothesis" ? "active" : ""}`}
                      onClick={() => setDecisionMode("hypothesis")}
                    >
                      🧪 Khả thi giả thuyết nghiên cứu
                    </button>
                    <button
                      type="button"
                      className={`decision-mode-btn ${decisionMode === "review" ? "active" : ""}`}
                      onClick={() => setDecisionMode("review")}
                    >
                      📑 Phê duyệt thay đổi (General Review)
                    </button>
                  </div>
                </div>

                <div className="decision-sample-prompts">
                  <span>Mẫu nhanh:</span>
                  <button
                    type="button"
                    className="sample-prompt-pill"
                    onClick={() => {
                      setDecisionMode("safety");
                      setDecisionInput("Đề xuất thay đổi tỷ lệ chất tẩy rửa công đoạn phun: Sử dụng chất 297 nguyên chất 100%, không pha thêm 289 (30%) và 299A (2%).");
                    }}
                  >
                    Vệ sinh: dùng 297 100%
                  </button>
                  <button
                    type="button"
                    className="sample-prompt-pill"
                    onClick={() => {
                      setDecisionMode("safety");
                      setDecisionInput("Khu vực chứa hóa chất dễ cháy MEK và IPA: dự kiến tắt quạt hút cưỡng bức trong 2 giờ để bảo dưỡng định kỳ trong khi công nhân vẫn thao tác rửa khuôn.");
                    }}
                  >
                    Tắt thông gió khi rửa khuôn
                  </button>
                  <button
                    type="button"
                    className="sample-prompt-pill"
                    onClick={() => {
                      setDecisionMode("hypothesis");
                      setDecisionInput("Giả thuyết: Bổ sung chất hoạt động bề mặt không ion (non-ionic surfactant) vào dung dịch tẩy rửa sẽ giảm sức căng bề mặt và tăng hiệu quả tẩy dầu mỡ kim loại lên 40%.");
                    }}
                  >
                    Bổ sung chất hoạt động bề mặt
                  </button>
                </div>

                <div className="decision-input-group">
                  <textarea
                    rows={4}
                    className="decision-textarea"
                    placeholder="Mô tả đề xuất, công thức hóa học, thay đổi quy trình hoặc giả thuyết nghiên cứu cần thẩm định..."
                    value={decisionInput}
                    onChange={(e) => setDecisionInput(e.target.value)}
                  />
                  <div className="decision-action-bar">
                    <button
                      className="primary"
                      disabled={decisionBusy || !decisionInput.trim()}
                      onClick={() => runDecisionEvaluation()}
                    >
                      {decisionBusy ? "Đang thẩm định xác suất…" : "⚡ Thẩm định với GPT-6 Luna Decisions"}
                    </button>
                    {decisionInput && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setDecisionInput("");
                          setDecisionResult(null);
                        }}
                      >
                        Xóa nội dung
                      </button>
                    )}
                  </div>
                </div>

                {decisionError && (
                  <div className="notice danger" role="alert" style={{ marginTop: 12 }}>
                    {decisionError}
                  </div>
                )}

                {decisionResult && (
                  <div className="decision-result-container">
                    <div className="decision-result-header">
                      <h3>Kết quả Thẩm định từ GPT-6 Luna</h3>
                      <span className="eval-meta">
                        Mô hình: <code>{decisionResult.model}</code> · Nguồn: {decisionResult.provider}
                      </span>
                    </div>

                    {decisionResult.answers.map((ans, idx) => {
                      const isAccept = ans.choice === "accept" || ans.choice === "safe" || ans.choice === "yes";
                      return (
                        <div key={idx} className={`decision-verdict-box ${isAccept ? "accept" : "review"}`}>
                          <div className="verdict-banner">
                            <span className="verdict-icon">{isAccept ? "✅" : "⚠️"}</span>
                            <div>
                              <h4>
                                {isAccept
                                  ? "KẾT LUẬN: ĐỦ ĐIỀU KIỆN CHẤP THUẬN (ACCEPT / FEASIBLE)"
                                  : "KẾT LUẬN: CẦN THẨM ĐỊNH LẠI & CẢNH BÁO RỦI RO (REVIEW REQUIRED)"}
                              </h4>
                              <p className="verdict-desc">
                                {isAccept
                                  ? "Mô hình nhận định đề xuất có căn cứ khoa học/an toàn đầy đủ và độ tin cậy cao."
                                  : "Mô hình phát hiện thiếu bằng chứng kiểm chứng, tiềm ẩn rủi ro tương thích hoặc nguy cơ an toàn; bắt buộc phải rà soát lại SDS/MSDS."}
                              </p>
                            </div>
                            {typeof ans.confidence === "number" && (
                              <div className="confidence-badge">
                                <span className="conf-label">Độ tin cậy</span>
                                <span className="conf-value">{Math.round(ans.confidence * 100)}%</span>
                              </div>
                            )}
                          </div>

                          {ans.probabilities && ans.probabilities.length > 0 && (
                            <div className="probabilities-breakdown">
                              <span className="prob-title">Phân phối xác suất quyết định:</span>
                              <div className="prob-bars">
                                {ans.probabilities.map((p, pIdx) => (
                                  <div key={pIdx} className="prob-item">
                                    <div className="prob-label-row">
                                      <span className="prob-name">
                                        {p.value === "accept" || p.value === "safe" || p.value === "yes"
                                          ? "✅ Chấp thuận (Accept/Safe)"
                                          : "⚠️ Xem xét lại (Review/Risks)"}
                                      </span>
                                      <span className="prob-pct">{Math.round(p.probability * 100)}%</span>
                                    </div>
                                    <div className="prob-track">
                                      <div
                                        className={`prob-fill ${
                                          p.value === "accept" || p.value === "safe" || p.value === "yes"
                                            ? "fill-green"
                                            : "fill-amber"
                                        }`}
                                        style={{ width: `${Math.round(p.probability * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {decisionResult.usage && (
                      <div className="decision-footer-meta">
                        <span>Tổng tokens xử lý: {decisionResult.usage.total_tokens}</span>
                        <span>Thời điểm thẩm định: {new Date(decisionResult.evaluatedAt).toLocaleTimeString("vi-VN")}</span>
                      </div>
                    )}
                  </div>
                )}
              </section>
              <div className="bottom-note">
                <FileCode2 size={22} />
                <p>
                  <strong>Cần chạy các pipeline chuyên sâu?</strong> Các script
                  của 177 kỹ năng có sẵn trong thư viện. Cài từng môi trường
                  theo tài liệu gốc; pipeline GPU/HPC và dịch vụ bên ngoài chưa
                  được thực thi trong ứng dụng này.
                </p>
              </div>
            </>
          )}
          {tab === "audit" && (
            <>
              <div className="simple-heading">
                <div className="eyebrow">TRACEABLE BY DESIGN</div>
                <h1>Audit & mã nguồn</h1>
                <p>
                  Đối chiếu từng file trong tệp nén, đọc tài liệu gốc và theo
                  dõi chính xác phạm vi kiểm tra.
                </p>
              </div>
              <div className="notice">
                <ShieldCheck size={20} />
                <div>
                  <strong>
                    {String(summary?.files || 2780)} file được đọc toàn bộ byte
                    và xác minh CRC/SHA-256.
                  </strong>
                  <p>
                    Kiểm tra tự động không tương đương đọc hiểu thủ công từng
                    dòng, kiểm định khoa học hay chạy thành công mọi thư viện.
                  </p>
                </div>
              </div>
              <div className="audit-grid">
                <div className="tool-card">
                  <h3>Bằng chứng có thể kiểm tra</h3>
                  <p>
                    Manifest ghi tên, kích thước, SHA-256 và các phép kiểm đã
                    thực hiện cho từng file.
                  </p>
                  {[
                    ["summary.json", "Tổng hợp audit"],
                    ["manifest.json", "Danh mục đầy đủ"],
                    ["findings.json", "Các điểm cần kiểm tra"],
                  ].map(([f, label]) => (
                    <a
                      className="audit-download"
                      key={f}
                      href={"/audit/" + f}
                      download
                    >
                      {label}
                      <ArrowDownToLine size={16} />
                    </a>
                  ))}
                  <small>SHA-256 tệp nén</small>
                  <code className="hash">
                    {String(summary?.archiveSha256 || "Đang tải…")}
                  </code>
                </div>
                <div className="tool-card">
                  <h3>Phạm vi chạy online</h3>
                  <ul className="capability-list">
                    <li>
                      <Check size={17} />
                      Toàn bộ tài liệu & tệp nguồn nguyên bản
                    </li>
                    <li>
                      <Check size={17} />
                      Tìm bài báo Europe PMC với nguồn thật
                    </li>
                    <li>
                      <Check size={17} />
                      Dự án và ghi chú lưu trên trình duyệt
                    </li>
                    <li>
                      <Check size={17} />
                      Thống kê CSV và trình tự DNA
                    </li>
                    <li>
                      <Settings2 size={17} />
                      Trợ lý AI: cần API key và đăng nhập
                    </li>
                    <li>
                      <Settings2 size={17} />
                      Python/GPU/HPC: môi trường riêng theo kỹ năng
                    </li>
                  </ul>
                  <a
                    className="text-button"
                    href="https://github.com/mrbit4578/nghiencuu-khoahoc-agent"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mã nguồn & hướng dẫn deploy <ExternalLink size={15} />
                  </a>
                </div>
              </div>
              <div className="section-heading">
                <h2>Toàn bộ tệp gốc</h2>
                <span className="subtle">
                  {files.length} file · Không sửa nội dung upstream
                </span>
              </div>
              <label className="search-field file-search">
                <Search size={18} />
                <input
                  aria-label="Tìm tệp gốc"
                  placeholder="Lọc theo đường dẫn hoặc tên file…"
                  value={fileQuery}
                  onChange={(e) => {
                    setFileQuery(e.target.value);
                    setFilePage(0);
                  }}
                />
              </label>
              <div className="file-list">
                {filteredFiles
                  .slice(filePage * 60, (filePage + 1) * 60)
                  .map((f) => (
                    <div className="file-row" key={f}>
                      <FileCode2 size={16} />
                      <span>{f}</span>
                      {/\.(md|py|json|toml|txt|yaml|yml|csv|tsv|sh|tex|xml|cff)$/i.test(
                        f,
                      ) && (
                        <button
                          className="text-button"
                          onClick={() => setDocPath(f)}
                        >
                          Xem
                        </button>
                      )}
                      <a href={fileUrl(f)} download aria-label={"Tải " + f}>
                        <ArrowDownToLine size={16} />
                      </a>
                    </div>
                  ))}
              </div>
              <div className="results-line">
                <span>
                  {filteredFiles.length} file phù hợp · Trang {filePage + 1}/
                  {Math.max(1, Math.ceil(filteredFiles.length / 60))}
                </span>
                <div className="pagination">
                  <button
                    className="button secondary"
                    disabled={filePage === 0}
                    onClick={() => setFilePage(filePage - 1)}
                  >
                    Trước
                  </button>
                  <button
                    className="button secondary"
                    disabled={(filePage + 1) * 60 >= filteredFiles.length}
                    onClick={() => setFilePage(filePage + 1)}
                  >
                    Sau
                  </button>
                </div>
              </div>
            </>
          )}
          <footer className="main-footer">
            <span>
              RESEARCH AGENT <span className="footer-dot">·</span> Không gian
              cho khám phá
            </span>
            <span>Powered by Scientific Agent Skills · K-Dense · MIT</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {docPath && (
        <div className="modal-backdrop" onClick={() => setDocPath("")}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Tài liệu gốc"
            className="document-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <BookOpen size={18} />
                <span>{docPath}</span>
              </div>
              <div>
                <a
                  className="icon-button"
                  href={fileUrl(docPath)}
                  download
                  title="Tải bản gốc"
                >
                  <ArrowDownToLine size={18} />
                </a>
                <button
                  className="icon-button"
                  autoFocus
                  onClick={() => setDocPath("")}
                  aria-label="Đóng tài liệu"
                >
                  <X size={21} />
                </button>
              </div>
            </div>
            <div className="document-content">
              {docLoading ? (
                <div className="empty-state">
                  <LoaderCircle className="spin" size={30} />
                  Đang tải tài liệu…
                </div>
              ) : docPath.endsWith(".md") ? (
                <Markdown text={doc} file={docPath} openFile={setDocPath} />
              ) : (
                <pre className="source-code">{doc}</pre>
              )}
            </div>
            {docPath.startsWith("skills/") && (
              <div className="document-footer">
                <span>Nguồn gốc được bảo toàn · Tài liệu tiếng Anh</span>
                <button
                  className="button primary"
                  onClick={() => {
                    const id = docPath.split("/")[1];
                    toggleSkill(id);
                    setDocPath("");
                  }}
                >
                  <Plus size={16} />
                  Chọn / bỏ chọn kỹ năng
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {sourceLocation && sourceDocuments.find((document) => document.id === sourceLocation.documentId) && <SourcePreview
        document={sourceDocuments.find((document) => document.id === sourceLocation.documentId)!} location={sourceLocation} onClose={() => setSourceLocation(null)} />}
      {config && (
        <div className="modal-backdrop" onClick={() => setConfig(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-title"
            className="config-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="config-title">Cấu hình workspace</h2>
              <button
                autoFocus
                className="icon-button"
                onClick={() => setConfig(false)}
                aria-label="Đóng cấu hình"
              >
                <X size={20} />
              </button>
            </div>
            <div className="config-content">
              <span className={"badge " + (status?.ai ? "green" : "amber")}>
                {status?.ai ? "AI đã được cấu hình" : "AI chưa được kích hoạt"}
              </span>
              <h3>
                {status?.ai
                  ? "AI đã sẵn sàng cho phiên nghiên cứu"
                  : "Kết nối dịch vụ AI"}
              </h3>
              {status?.ai && (
                <>
                  <div
                    className="env-list"
                    aria-label="Dịch vụ AI đang sử dụng"
                  >
                    <code>{status.aiProvider || "Dịch vụ AI"}</code>
                    <code>{status.aiModel}</code>
                  </div>
                  <p>
                    API key đã được cấu hình trên máy chủ. Bạn chỉ cần đăng nhập
                    workspace bên dưới để bắt đầu phân tích.
                  </p>
                </>
              )}
              <div style={{ margin: "16px 0", padding: "14px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface-alt)" }}>
                <span className="field-label" style={{ display: "block", marginBottom: 8, fontSize: "11px", fontWeight: 700 }}>
                  CHẾ ĐỘ GIAO DIỆN (THEME)
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className={`button ${theme === "light" ? "primary" : "secondary"}`}
                    onClick={() => toggleTheme("light")}
                    style={{ flex: 1, minHeight: 38 }}
                  >
                    <Sun size={16} /> Nền Sáng
                  </button>
                  <button
                    type="button"
                    className={`button ${theme === "dark" ? "primary" : "secondary"}`}
                    onClick={() => toggleTheme("dark")}
                    style={{ flex: 1, minHeight: 38 }}
                  >
                    <Moon size={16} /> Nền Tối (Chống chói)
                  </button>
                </div>
              </div>

              <div style={{ margin: "16px 0", padding: "16px", borderRadius: "10px", border: "1px solid var(--line)", background: "var(--surface-alt)" }}>
                <span className="field-label" style={{ display: "block", marginBottom: 6, fontSize: "11px", fontWeight: 700 }}>
                  QUẢN LÝ NHIỀU NGUỒN API KEY (MULTI-PROVIDER)
                </span>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "0 0 12px" }}>
                  Hệ thống hỗ trợ kết nối đồng thời nhiều dịch vụ AI. Bạn có thể lưu key trực tiếp trên máy hoặc cấu hình trên Vercel.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: 4 }}>
                      1. Experiential Labs API Key (Claude, GPT-4.1, DeepSeek & GPT-6 Luna)
                    </label>
                    <input
                      type="password"
                      placeholder="xpl_403f9644e5ecda298ae346a48694448ec6c0d2a2..."
                      value={customExpKey}
                      onChange={(e) => setCustomExpKey(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px" }}
                    />
                    <small style={{ color: "var(--muted)", fontSize: "11px", display: "block", marginTop: 3 }}>
                      Đang kích hoạt: Hỗ trợ mô hình <strong>gpt-6-luna-decisions</strong>, <strong>claude-haiku-4.5</strong>, <strong>deepseek-v4.1-flash</strong> và <strong>gpt-4.1-mini</strong>
                    </small>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: 4 }}>
                      2. LarpRouter / Lutheos / OpenAI API Key (Tùy chọn)
                    </label>
                    <input
                      type="password"
                      placeholder="lrsk-... hoặc sk-..."
                      value={customAiKey}
                      onChange={(e) => setCustomAiKey(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, marginBottom: 4 }}>
                      3. Custom Base URL (Tùy chọn endpoint riêng)
                    </label>
                    <input
                      type="text"
                      placeholder="https://api.experientiallabs.ai/v1 hoặc https://api.openai.com/v1"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: "12px" }}
                    />
                    <small style={{ color: "var(--muted)", fontSize: "11px", display: "block", marginTop: 3 }}>
                      * Lưu ý: Chỉ nhập URL gốc (ví dụ: <code>https://api.experientiallabs.ai/v1</code>). Hệ thống tự động ghép endpoint phù hợp.
                    </small>
                  </div>

                  {/* Nút bấm Lưu cấu hình và Kiểm tra kết nối */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="button primary"
                      onClick={handleSaveApiKeys}
                      style={{ flex: 1, minHeight: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      <Check size={16} /> Lưu cấu hình
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      disabled={testLoading}
                      onClick={handleTestConnection}
                      style={{ flex: 1, minHeight: 38, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    >
                      {testLoading ? <LoaderCircle size={16} className="spin" /> : <Activity size={16} />}
                      {testLoading ? "Đang kiểm tra kết nối..." : "Kiểm tra kết nối"}
                    </button>
                  </div>

                  {saveSuccessNotice && (
                    <div style={{ padding: "8px 12px", background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981", borderRadius: 8, color: "#10b981", fontSize: "12px", display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={16} /> {saveSuccessNotice}
                    </div>
                  )}

                  {testResults && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                      {testResults.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            fontSize: "12px",
                            lineHeight: 1.5,
                            background: r.status === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                            border: `1px solid ${r.status === "success" ? "#10b981" : "#ef4444"}`,
                            color: "var(--ink)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 3, color: r.status === "success" ? "#10b981" : "#ef4444" }}>
                            {r.status === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
                            <span>{r.provider}</span>
                          </div>
                          <p style={{ margin: 0 }}>{r.message}</p>
                          {r.models && r.models.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                              {r.models.map((m) => (
                                <span key={m} style={{ padding: "2px 6px", borderRadius: 4, background: "var(--surface)", fontSize: "11px", border: "1px solid var(--line)" }}>
                                  ⚡ {m}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <details open={!status?.ai}>
                <summary>Cấu hình máy chủ và triển khai</summary>
                <p>
                  Khi triển khai Vercel, thêm các biến môi trường trong Settings
                  → Environment Variables rồi redeploy. Không nhập API key vào
                  mã nguồn.
                </p>
                <div className="env-list">
                  {[
                    "AI_API_KEY",
                    "AI_BASE_URL",
                    "AI_MODEL",
                    "APP_PASSWORD",
                    "AUTH_SECRET",
                  ].map((v) => (
                    <code key={v}>{v}</code>
                  ))}
                </div>
                <p>
                  <strong>AI_BASE_URL</strong> hỗ trợ API Chat Completions tương
                  thích OpenAI. <strong>AUTH_SECRET</strong> cần ít nhất 32 ký
                  tự ngẫu nhiên.
                </p>
              </details>
              <hr />
              {status?.authenticated ? (
                <>
                  <div className="notice">
                    <Check size={17} />
                    Bạn đã đăng nhập workspace.
                  </div>
                  <button
                    className="button secondary"
                    onClick={async () => {
                      await fetch("/api/auth", { method: "DELETE" });
                      await refreshStatus();
                    }}
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <form onSubmit={login}>
                  <p id="workspace-password-help">
                    Dùng mật khẩu workspace đã được cấp. Đây là mật khẩu đăng
                    nhập ứng dụng, không phải API key LarpRouter.
                  </p>
                  <label className="field-label">
                    MẬT KHẨU WORKSPACE
                    <input
                      type="password"
                      autoComplete="current-password"
                      maxLength={256}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setLoginError("");
                      }}
                      placeholder="Nhập mật khẩu workspace"
                      aria-describedby="workspace-password-help"
                      required
                    />
                  </label>
                  {loginError && (
                    <div className="notice danger" role="alert">
                      {loginError}
                    </div>
                  )}
                  {!status?.authConfigured && (
                    <div className="notice danger" role="alert" style={{ marginTop: 8, fontSize: "11px", lineHeight: 1.5 }}>
                      ⚠️ Máy chủ chưa nhận biến môi trường (cần <code>APP_PASSWORD</code> và <code>AUTH_SECRET</code>).
                      Nếu anh vừa thêm trên Vercel, vui lòng vào tab <strong>Deployments</strong> và bấm <strong>Redeploy</strong>.
                    </div>
                  )}
                  <button
                    className="button primary full"
                    disabled={!status?.authConfigured || loginBusy}
                    title={!status?.authConfigured ? "Cần cấu hình biến môi trường APP_PASSWORD và AUTH_SECRET trên máy chủ" : "Bấm để đăng nhập"}
                  >
                    {loginBusy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    Đăng nhập
                  </button>
                </form>
              )}
              <div className="storage-note">
                <FolderKanban size={18} />
                <p>
                  Dự án được lưu tự động trong trình duyệt. Thêm
                  UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN để đồng bộ
                  nhiều thiết bị qua nút Đồng bộ đám mây. Đây là một workspace
                  dùng chung mật khẩu.
                </p>
              </div>
              <p className="subtle">
                Hạn mức AI:{" "}
                {status?.durableQuota
                  ? "Redis dùng chung giữa các instance"
                  : "Bộ nhớ từng instance; cấu hình Redis hoặc Vercel WAF cho môi trường public"}
                .
              </p>
            </div>
          </section>
        </div>
      )}
      {showHistoryModal && (
        <div className="modal-backdrop" onClick={() => setShowHistoryModal(false)}>
          <section
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 id="history-title" style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, color: "var(--ink)" }}>
                  <History size={20} color="var(--teal)" /> Nhật ký hội thoại nghiên cứu
                </h2>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Đã lưu {historySessions.length} phiên đối thoại · Tự động đồng bộ tại trình duyệt này
                </span>
              </div>
              <button
                className="icon-button"
                aria-label="Đóng nhật ký"
                onClick={() => setShowHistoryModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="history-search-bar">
              <input
                type="text"
                placeholder="Tìm kiếm từ khóa câu hỏi, hóa chất, số CAS trong nhật ký..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>

            <div className="history-list">
              {historySessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
                  <Clock size={36} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontWeight: 500, color: "var(--ink)" }}>Chưa có phiên đối thoại nào được lưu.</p>
                  <small style={{ color: "var(--muted)" }}>Khi bạn đặt câu hỏi cho trợ lý AI, nhật ký sẽ tự động được lưu lại tại đây.</small>
                </div>
              ) : (
                historySessions
                  .filter(
                    (s) =>
                      s.title.toLowerCase().includes(historySearch.toLowerCase()) ||
                      s.messages.some((m) => m.content.toLowerCase().includes(historySearch.toLowerCase())),
                  )
                  .map((s) => {
                    const isActive = s.id === currentSessionId && chat.length > 0;
                    return (
                      <div
                        key={s.id}
                        className={`history-item-card ${isActive ? "active" : ""}`}
                        onClick={() => restoreSession(s)}
                      >
                        <div className="history-item-info">
                          <div className="history-item-title">
                            {isActive ? "🟢 " : ""}
                            {s.title || "Cuộc trò chuyện nghiên cứu"}
                          </div>
                          <div className="history-item-meta">
                            <span>🕒 {new Date(s.updatedAt).toLocaleString("vi-VN")}</span>
                            <span>💬 {s.messages.length} tin nhắn</span>
                            <span style={{ background: "var(--surface-alt)", border: "1px solid var(--line)", padding: "1px 6px", borderRadius: "4px" }}>
                              {s.model}
                            </span>
                            <span>
                              {s.language === "vi" ? "🇻🇳 Tiếng Việt" : s.language === "zh" ? "🇨🇳 中文" : "🇬🇧 English"}
                            </span>
                            {s.documentNames && s.documentNames.length > 0 && (
                              <span style={{ color: "var(--teal)" }}>
                                📎 {s.documentNames.slice(0, 2).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="history-item-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              restoreSession(s);
                            }}
                            title="Mở lại cuộc trò chuyện này"
                          >
                            Mở lại
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleExportWord(s);
                            }}
                            title="Xuất file Word (.docx) chuẩn báo cáo nghiên cứu khoa học"
                          >
                            <FileText size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPdf(s);
                            }}
                            title="Xuất / In PDF (A4) chuẩn nghiên cứu khoa học"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const md = exportSessionToMarkdown(s);
                              download(
                                `chat-${s.title.slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, "_")}.md`,
                                md,
                                "text/markdown",
                              );
                            }}
                            title="Tải về file Markdown .md"
                          >
                            <ArrowDownToLine size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={(e) => void removeSession(s.id, e)}
                            title="Xóa phiên này"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div className="document-footer" style={{ borderTop: "1px solid var(--line)", padding: "12px 20px" }}>
              <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>
                Dữ liệu nhật ký được lưu trữ an toàn trong IndexedDB của trình duyệt.
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                {historySessions.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        const json = JSON.stringify(historySessions, null, 2);
                        download(`all-chat-history-${Date.now()}.json`, json, "application/json");
                      }}
                    >
                      <ArrowDownToLine size={14} /> Xuất toàn bộ JSON
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #f87171" }}
                      onClick={() => void clearHistory()}
                    >
                      <Trash2 size={14} /> Xóa tất cả
                    </button>
                  </>
                )}
                <button type="button" className="button primary" onClick={() => setShowHistoryModal(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
