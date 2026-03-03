export type JsonObject = Record<string, unknown>;

export type FunctionDeclaration = {
  name: string;
  description: string;
  parametersJsonSchema: JsonObject;
};

export type AgentHistoryContent = {
  role: "user" | "model" | "assistant" | "system";
  parts: Array<{ text?: string }>;
};

export type ToolMessage = {
  functionResponse: {
    id: string;
    name: string;
    response: JsonObject;
  };
};

export type SendMessageResult = {
  text?: string;
  functionCalls?: Array<{ id?: string; name?: string; args?: JsonObject }>;
};

export function flattenParts(parts: Array<{ text?: string }>): string {
  return parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_listings",
    description: "出品一覧を取得します。カテゴリや状態でフィルタリングできます。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "カテゴリでフィルタ (wagyu, sake, craft)",
        },
        status: {
          type: "string",
          description: "状態でフィルタ (open, locked, active, completed, cancelled)",
        },
        limit: {
          type: "number",
          description: "取得件数の上限（デフォルト: 10）",
        },
      },
    },
  },
  {
    name: "get_listing_detail",
    description: "特定の出品の詳細情報を取得します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        escrowAddress: {
          type: "string",
          description: "出品（取引管理）のアドレス",
        },
        tokenId: {
          type: "string",
          description: "トークンID",
        },
      },
      required: ["escrowAddress"],
    },
  },
  {
    name: "prepare_listing_draft",
    description: "出品ドラフトを生成します。ユーザーの説明から出品情報を構造化します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "カテゴリ (wagyu, sake, craft)",
        },
        title: {
          type: "string",
          description: "出品タイトル（例: 神戸牛A5ランク）",
        },
        description: {
          type: "string",
          description: "出品の詳細説明",
        },
        totalAmount: {
          type: "string",
          description: "総額（JPYC単位、例: 500000）",
        },
        imageURI: {
          type: "string",
          description: "画像URI（オプション）",
        },
      },
      required: ["category", "title", "description", "totalAmount"],
    },
  },
  {
    name: "get_milestones_for_category",
    description: "指定カテゴリのマイルストーン（進捗ベース支払い条件）を取得します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "カテゴリ (wagyu, sake, craft)",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "prepare_transaction",
    description: "操作を準備し、確認UIを表示します。実際の確認はユーザーが行います。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "操作の種類 (createListing, lock, approve, cancel, confirmDelivery)",
        },
        escrowAddress: {
          type: "string",
          description: "対象の取引アドレス（createListing以外で必要）",
        },
        amount: {
          type: "string",
          description: "lock時に必要なJPYC金額（例: 500000）。省略時は出品情報から補完されます。",
        },
        draft: {
          type: "object",
          description: "出品ドラフト（createListingの場合）",
          properties: {
            category: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            totalAmount: { type: "string" },
            imageURI: { type: "string" },
          },
        },
      },
      required: ["action"],
    },
  },
  {
    name: "analyze_market",
    description: "カテゴリ別の市場分析・価格提案を行います。出品数、平均価格、中央値、最高値、最低値を算出します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "分析対象のカテゴリ (wagyu, sake, craft)。省略時は全カテゴリ。",
        },
      },
    },
  },
  {
    name: "assess_risk",
    description: "特定の出品または出品者の購入リスクを評価します。出品者の過去実績（完了率、キャンセル率）を分析しリスクスコアを返します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        escrowAddress: {
          type: "string",
          description: "評価対象の出品アドレス",
        },
        producerAddress: {
          type: "string",
          description: "評価対象の出品者アドレス（escrowAddressがない場合に使用）",
        },
      },
    },
  },
  {
    name: "suggest_next_action",
    description: "ユーザーの現在の状況を分析し、次に取るべきアクションを提案します。Producer/Buyer両方の役割で保有リスティングの状態を確認します。",
    parametersJsonSchema: {
      type: "object",
      properties: {
        userAddress: {
          type: "string",
          description: "ユーザーのアカウントアドレス",
        },
      },
      required: ["userAddress"],
    },
  },
];
