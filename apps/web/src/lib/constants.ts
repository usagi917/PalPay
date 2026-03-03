// Milestone names by category type
// Used in hooks.ts and NFT image API
export const MILESTONE_NAMES: Record<number, string[]> = {
  0: ["子牛購入", "飼育開始", "体重100kg", "体重200kg", "体重300kg", "体重400kg", "体重500kg", "出荷準備", "出荷", "納品完了"], // wagyu
  1: ["仕込み", "発酵", "熟成", "瓶詰め", "出荷"], // sake
  2: ["制作開始", "窯焼き", "絵付け", "仕上げ"], // craft
  3: ["完了"], // other/default
};

// Get milestone name by category type and index
export function getMilestoneName(categoryType: number, index: number): string {
  const names = MILESTONE_NAMES[categoryType] || MILESTONE_NAMES[3];
  return names[index] || `Step ${index + 1}`;
}
