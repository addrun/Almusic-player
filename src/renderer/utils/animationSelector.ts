/**
 * 舞台播放器动画选择器
 *
 * 智能选择动画预设，避免重复和连续数字
 *
 * 规则：
 * 1. 不能选择与上一次相同的动画
 * 2. 不能选择连续数字的动画（例如不能用 3 然后用 4）
 * 3. 从剩余选项中随机选择
 */

export class AnimationSelector {
  // 上一次选择的动画索引
  private lastIndex: number = -1

  // 上一次选择的动画所在的行索引
  private lastLineIndex: number = -1

  // 动画总数（普通模式 0-7，共 8 个）
  private readonly totalAnimations: number

  constructor(totalAnimations: number = 8) {
    this.totalAnimations = totalAnimations
  }

  /**
   * 选择一个动画索引
   *
   * @param lineIndex 当前行索引
   * @returns 动画索引（0 到 totalAnimations-1）
   */
  select(lineIndex: number): number {
    // 如果是同一行，返回上一次选择的动画
    if (lineIndex === this.lastLineIndex && this.lastIndex !== -1) {
      return this.lastIndex
    }

    // 构建可选动画列表
    const available: number[] = []

    for (let i = 0; i < this.totalAnimations; i++) {
      // 规则 1：过滤掉与上次相同的动画
      if (i === this.lastIndex) {
        continue
      }

      // 规则 2：过滤掉连续数字
      if (this.lastIndex !== -1) {
        const diff = Math.abs(i - this.lastIndex)
        if (diff === 1) {
          continue
        }
      }

      available.push(i)
    }

    // 如果没有可用动画（理论上不会发生），返回 0
    if (available.length === 0) {
      this.lastIndex = 0
      this.lastLineIndex = lineIndex
      return 0
    }

    // 从可用动画中随机选择
    const randomIndex = Math.floor(Math.random() * available.length)
    const selected = available[randomIndex]

    // 更新状态
    this.lastIndex = selected
    this.lastLineIndex = lineIndex

    return selected
  }

  /**
   * 重置选择器状态
   * 在切换歌曲或重新开始播放时调用
   */
  reset(): void {
    this.lastIndex = -1
    this.lastLineIndex = -1
  }

  /**
   * 获取上一次选择的动画索引
   * 主要用于调试和测试
   */
  getLastIndex(): number {
    return this.lastIndex
  }

  /**
   * 获取上一次选择的行索引
   * 主要用于调试和测试
   */
  getLastLineIndex(): number {
    return this.lastLineIndex
  }
}

/**
 * 创建动画选择器实例
 *
 * @param totalAnimations 动画总数，默认为 8（普通模式）
 * @returns AnimationSelector 实例
 */
export function createAnimationSelector(totalAnimations: number = 8): AnimationSelector {
  return new AnimationSelector(totalAnimations)
}

export default AnimationSelector
