import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { openProject } from "../project-session";

/**
 * Abre um projeto salvo e avisa o que não deu certo (arquivo movido, música ausente).
 * `opening` é o id em carregamento, para a lista mostrar o progresso.
 */
export function useOpenProject(): { open: (id: string) => Promise<boolean>; opening: string | null } {
  const { t } = useTranslation();
  const [opening, setOpening] = useState<string | null>(null);

  const open = useCallback(
    async (id: string) => {
      setOpening(id);
      try {
        const result = await openProject(id);
        if (result.status !== "ok") {
          toast.error(t(result.status === "notFound" ? "projects.notFound" : "projects.invalid"));
          return false;
        }
        if (result.missing.length > 0) {
          toast.warning(t("projects.missing", { count: result.missing.length }), {
            description: result.missing.slice(0, 4).join("\n"),
          });
        }
        void result.music.then((ok) => {
          if (!ok) toast.warning(t("projects.musicMissing"));
        });
        return true;
      } catch (err) {
        toast.error(t("projects.openError"), { description: String(err) });
        return false;
      } finally {
        setOpening(null);
      }
    },
    [t],
  );

  return { open, opening };
}
