interface KugouAudioRecoveryOptions<T> {
  url: string;
  load: (url: string) => Promise<T>;
  resolve: () => Promise<string | null | undefined>;
  reject: (url: string) => void;
  cancelLoad: () => void;
  dispose: (sound: T) => void;
  isActive: () => boolean;
  budgetMs?: number;
}

class RecoveryCancelled extends Error {}
class RecoveryBudgetExceeded extends Error {}

/** Only audio-loading failures advance sources. Player setup stays outside this helper. */
export async function recoverKugouAudio<T>(
  options: KugouAudioRecoveryOptions<T>
): Promise<{ sound: T; url: string } | null> {
  const deadline = Date.now() + (options.budgetMs ?? 45000);
  const attempted = new Set<string>();
  let url = options.url;
  let resolutions = 0;
  let lastError: unknown = new Error('未找到可用的备用音源');

  const bounded = async <R>(operation: () => Promise<R>, onLate?: (value: R) => void) => {
    if (!options.isActive()) throw new RecoveryCancelled();
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new RecoveryBudgetExceeded('酷狗备用播放已超时');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancellation: ReturnType<typeof setInterval> | undefined;
    let abandoned = false;
    const pending = Promise.resolve().then(operation);
    pending.then(
      (value) => {
        if (abandoned) onLate?.(value);
      },
      () => {}
    );
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new RecoveryBudgetExceeded('酷狗备用播放已超时')),
            remaining
          );
          cancellation = setInterval(() => {
            if (!options.isActive()) reject(new RecoveryCancelled());
          }, 50);
        })
      ]);
    } catch (error) {
      abandoned = true;
      throw error;
    } finally {
      clearTimeout(timer);
      clearInterval(cancellation);
    }
  };

  try {
    while (options.isActive()) {
      if (Date.now() >= deadline) throw new RecoveryBudgetExceeded('酷狗备用播放已超时');
      if (url && !attempted.has(url)) {
        attempted.add(url);
        try {
          const sound = await bounded(() => options.load(url), options.dispose);
          if (!options.isActive()) {
            options.dispose(sound);
            return null;
          }
          return { sound, url };
        } catch (error) {
          if (error instanceof RecoveryCancelled || !options.isActive()) return null;
          lastError = error;
          options.reject(url);
          options.cancelLoad();
          if (error instanceof RecoveryBudgetExceeded) throw error;
        }
      }

      // The initial address plus at most three replacements means at most four loads.
      // A repeated address consumes a resolution attempt without reloading bad audio.
      if (resolutions >= 3) throw lastError;
      resolutions++;
      const replacement = await bounded(options.resolve);
      if (!replacement) throw lastError;
      url = replacement;
    }
    return null;
  } catch (error) {
    if (error instanceof RecoveryCancelled || !options.isActive()) return null;
    throw error;
  } finally {
    if (!options.isActive() || Date.now() >= deadline) options.cancelLoad();
  }
}
