"use client";

import { createContext, useContext } from "react";

export type Locale = "ja" | "en";

export const translations = {
  ja: {
    // Header
    appTitle: "Milestone Escrow",
    appSubtitle: "B2B Payment Infrastructure",

    // Hero
    heroEyebrow: "Proof of Trust",
    heroTitle: "刻む。証す。解放する。",


    // Wallet
    wallet: "アカウント",
    connectWallet: "ログイン",
    connecting: "ログイン中...",
    disconnect: "ログアウト",
    noMetaMask: "MetaMaskアプリが必要です",

    // Roles
    buyer: "バイヤー",
    producer: "生産者",
    admin: "管理者",
    observer: "オブザーバー",

    // Contract Summary
    contractSummary: "取引概要",
    tokenAddress: "通貨",
    buyerAddress: "バイヤー",
    producerAddress: "生産者",
    adminAddress: "管理者",
    totalAmount: "総額",
    lockedAmount: "預り中",
    releasedAmount: "支払済み",
    paidAmount: "支払い済み金額",
    refundedAmount: "返金済",
    progress: "進捗",
    cancelled: "キャンセル済",
    loading: "読み込み中...",
    noData: "データなし",

    // Actions
    actions: "アクション",
    lockFunds: "支払いを確定する",
    lockDescription: "お支払い金額を預け入れます",
    submitMilestone: "工程を申請",
    evidencePlaceholder: "証跡（URLまたは説明）",
    submit: "申請",
    submitAndReceive: "申請して受け取る",
    autoPaymentNote: "申請と同時にJPYCが自動で送金されます",
    cancelContract: "契約をキャンセル",
    cancelReasonPlaceholder: "キャンセル理由",
    cancelRefund: "キャンセル＆返金",
    processing: "処理中...",
    success: "成功！",
    viewTx: "詳細を確認",
    contractCancelled: "この取引はキャンセルされました。",
    noActionsAvailable: "現在利用できるアクションはありません",
    noActionsObserver: "このアカウントは取引参加者ではありません",
    connectWalletHint: "ログインすると操作メニューが表示されます",

    // Milestones
    milestones: "マイルストーン",
    code: "コード",
    description: "説明",
    rate: "支払割合",
    status: "状態",
    evidence: "証跡",
    evidenceHash: "証跡ID",
    completedAt: "完了日時",
    releasedAmountLabel: "支払額",
    pending: "未申請",
    completed: "完了",

    // Milestone Descriptions
    E1: "契約・個体登録",
    E2: "初期検疫・導入",
    E3_01: "月次肥育記録 1",
    E3_02: "月次肥育記録 2",
    E3_03: "月次肥育記録 3",
    E3_04: "月次肥育記録 4",
    E3_05: "月次肥育記録 5",
    E3_06: "月次肥育記録 6",
    E4: "出荷準備",
    E5: "出荷",
    E6: "受領・検収",

    // Timeline
    timeline: "タイムライン",
    noEvents: "イベントはまだありません",
    eventLocked: "お支払い",
    eventCompleted: "完了・支払い",
    eventCancelled: "キャンセル",
    actor: "実行者",
    amount: "金額",
    milestone: "マイルストーン",
    reason: "理由",
    refunded: "返金額",
    tx: "受付番号",
    block: "処理番号",

    // NFT
    refresh: "更新",
    attributes: "属性",

    // Footer
  },
  en: {
    // Header
    appTitle: "Milestone Escrow",
    appSubtitle: "B2B Payment Infrastructure",

    // Hero
    heroEyebrow: "Proof of Trust",
    heroTitle: "Record. Prove. Release.",
    heroSubtitle: "Bind time and agreement into a single ledger. Transparent evidence guides the release of value, quietly and precisely.",
    heroPillTrust: "Trust",
    heroPillEvidence: "Evidence",

    // Wallet
    wallet: "Account",
    connectWallet: "Log in",
    connecting: "Logging in...",
    disconnect: "Log out",
    noMetaMask: "MetaMask app is required",

    // Roles
    buyer: "Buyer",
    producer: "Producer",
    admin: "Admin",
    observer: "Observer",

    // Contract Summary
    contractSummary: "Transaction Summary",
    tokenAddress: "Currency",
    buyerAddress: "Buyer",
    producerAddress: "Producer",
    adminAddress: "Admin",
    totalAmount: "Total",
    lockedAmount: "Held",
    releasedAmount: "Paid",
    paidAmount: "Paid Amount",
    refundedAmount: "Refunded",
    progress: "Progress",
    cancelled: "Cancelled",
    loading: "Loading...",
    noData: "No data",

    // Actions
    actions: "Actions",
    lockFunds: "Confirm Payment",
    lockDescription: "Deposit the payment amount",
    submitMilestone: "Submit Milestone",
    evidencePlaceholder: "Evidence (URL or description)",
    submit: "Submit",
    submitAndReceive: "Submit & Receive",
    autoPaymentNote: "JPYC will be automatically transferred upon submission",
    cancelContract: "Cancel Contract",
    cancelReasonPlaceholder: "Reason for cancellation",
    cancelRefund: "Cancel & Refund",
    processing: "Processing...",
    success: "Success!",
    viewTx: "View Details",
    contractCancelled: "This transaction has been cancelled.",
    noActionsAvailable: "No actions available right now.",
    noActionsObserver: "This account is not a transaction participant.",
    connectWalletHint: "Log in to see available actions.",

    // Milestones
    milestones: "Milestones",
    code: "Code",
    description: "Description",
    rate: "Payment Rate",
    status: "Status",
    evidence: "Evidence",
    evidenceHash: "Evidence ID",
    completedAt: "Completed At",
    releasedAmountLabel: "Paid Amount",
    pending: "Pending",
    completed: "Completed",

    // Milestone Descriptions
    E1: "Contract & Cattle Registration",
    E2: "Initial Quarantine & Onboarding",
    E3_01: "Monthly Fattening Log 1",
    E3_02: "Monthly Fattening Log 2",
    E3_03: "Monthly Fattening Log 3",
    E3_04: "Monthly Fattening Log 4",
    E3_05: "Monthly Fattening Log 5",
    E3_06: "Monthly Fattening Log 6",
    E4: "Pre-shipment Preparation",
    E5: "Shipment",
    E6: "Receipt & Inspection",

    // Timeline
    timeline: "Timeline",
    noEvents: "No events yet",
    eventLocked: "Payment",
    eventCompleted: "Completed & Paid",
    eventCancelled: "Cancelled",
    actor: "Actor",
    amount: "Amount",
    milestone: "Milestone",
    reason: "Reason",
    refunded: "Refunded",
    tx: "Receipt No.",
    block: "Process No.",

    // NFT
    refresh: "Refresh",
    attributes: "Attributes",

    // Footer
  },
} as const;

export type TranslationKey = keyof typeof translations.ja;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
