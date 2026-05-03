// Wagyu marketplace milestones (10 steps matching MilestoneEscrowV6 BPS allocation)
const WAGYU_MILESTONES: readonly string[] = [
  "子牛購入",
  "飼育開始",
  "体重100kg",
  "体重200kg",
  "体重300kg",
  "体重400kg",
  "体重500kg",
  "出荷準備",
  "出荷",
  "納品完了",
];

export function getMilestoneName(index: number): string {
  return WAGYU_MILESTONES[index] ?? `Step ${index + 1}`;
}
