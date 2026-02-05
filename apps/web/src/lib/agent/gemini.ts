import { GoogleGenerativeAI, type Tool } from "@google/generative-ai";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Tool definitions for Gemini Function Calling
// Using plain object schema format for compatibility
const toolDeclarations = [
  {
    name: "get_listings",
    description: "出品一覧を取得します。カテゴリや状態でフィルタリングできます。",
    parameters: {
      type: "OBJECT",
      properties: {
        category: {
          type: "STRING",
          description: "カテゴリでフィルタ (wagyu, sake, craft)",
        },
        status: {
          type: "STRING",
          description: "状態でフィルタ (open, locked, active, completed, cancelled)",
        },
        limit: {
          type: "NUMBER",
          description: "取得件数の上限（デフォルト: 10）",
        },
      },
    },
  },
  {
    name: "get_listing_detail",
    description: "特定の出品の詳細情報を取得します。",
    parameters: {
      type: "OBJECT",
      properties: {
        escrowAddress: {
          type: "STRING",
          description: "出品（エスクロー）コントラクトのアドレス",
        },
        tokenId: {
          type: "STRING",
          description: "トークンID",
        },
      },
      required: ["escrowAddress"],
    },
  },
  {
    name: "prepare_listing_draft",
    description: "出品ドラフトを生成します。ユーザーの説明から出品情報を構造化します。",
    parameters: {
      type: "OBJECT",
      properties: {
        category: {
          type: "STRING",
          description: "カテゴリ (wagyu, sake, craft)",
        },
        title: {
          type: "STRING",
          description: "出品タイトル（例: 神戸牛A5ランク）",
        },
        description: {
          type: "STRING",
          description: "出品の詳細説明",
        },
        totalAmount: {
          type: "STRING",
          description: "総額（JPYC単位、例: 500000）",
        },
        imageURI: {
          type: "STRING",
          description: "画像URI（オプション）",
        },
      },
      required: ["category", "title", "description", "totalAmount"],
    },
  },
  {
    name: "get_milestones_for_category",
    description: "指定カテゴリのマイルストーン（進捗ベース支払い条件）を取得します。",
    parameters: {
      type: "OBJECT",
      properties: {
        category: {
          type: "STRING",
          description: "カテゴリ (wagyu, sake, craft)",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "prepare_transaction",
    description: "トランザクションを準備し、署名前確認UIを表示します。実際の署名はユーザーが行います。",
    parameters: {
      type: "OBJECT",
      properties: {
        action: {
          type: "STRING",
          description: "トランザクションの種類 (createListing, lock, approve, cancel, confirmDelivery)",
        },
        escrowAddress: {
          type: "STRING",
          description: "対象のエスクローアドレス（createListing以外で必要）",
        },
        draft: {
          type: "OBJECT",
          description: "出品ドラフト（createListingの場合）",
          properties: {
            category: { type: "STRING" },
            title: { type: "STRING" },
            description: { type: "STRING" },
            totalAmount: { type: "STRING" },
            imageURI: { type: "STRING" },
          },
        },
      },
      required: ["action"],
    },
  },
];

// Get Gemini model with tools
export function getGeminiModel() {
  // Cast to Tool[] since Gemini SDK accepts this format at runtime
  const tools = [{ functionDeclarations: toolDeclarations }] as unknown as Tool[];
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-05-20",
    tools,
  });
}
