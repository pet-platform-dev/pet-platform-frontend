"use client";
import type { OwnBreeder } from "@/entities/breeder/owner-api";
import { emptyBreederMedia } from "@/entities/breeder/media";
import { useBreederMedia } from "./use-breeder-media";
import {
  removeBreederMedia,
  reorderBreederMedia,
  addBreederVideo,
  updateBreederVideo,
} from "./api";
import { BreederLogoField } from "./breeder-logo-field";
import { BreederCoverField } from "./breeder-cover-field";
import { BreederGalleryEditor } from "./breeder-gallery-editor";
import { BreederVideoEditor } from "./breeder-video-editor";
import { BreederUploadStatus } from "./breeder-upload-status";
export function BreederMediaEditor({
  profile,
  disabled,
  onBusy,
}: {
  profile: OwnBreeder;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  profile = { ...profile, media: profile.media ?? emptyBreederMedia };
  const state = useBreederMedia(profile, onBusy);
  const locked = disabled || state.busy;
  const remove = (type: typeof state.scope) => (id: string) =>
    void state.command(() => removeBreederMedia(id), type);
  const feedback = (type: typeof state.scope) => (
    <>
      {state.scope === type && state.error && (
        <p role="alert" className="field-error">
          {state.error}
        </p>
      )}
      {state.scope === type &&
        state.busy &&
        !state.items.some((item) => item.status === "uploading") && (
          <p role="status">Зберігаємо медіа…</p>
        )}
      <BreederUploadStatus
        items={state.items.filter((item) => item.type === type)}
        busy={locked}
        retry={state.retry}
        discard={state.discard}
      />
    </>
  );
  return (
    <div className="breeder-media-editor">
      <p className="muted">Медіа зберігаються одразу після успішної дії.</p>
      <BreederLogoField
        image={profile.media.logo}
        disabled={locked}
        onAdd={(files) => state.add("LOGO", files)}
        onRemove={remove("LOGO")}
      >
        {feedback("LOGO")}
      </BreederLogoField>
      <BreederCoverField
        image={profile.media.cover}
        disabled={locked}
        onAdd={(files) => state.add("COVER", files)}
        onRemove={remove("COVER")}
      >
        {feedback("COVER")}
      </BreederCoverField>
      <BreederGalleryEditor
        images={profile.media.gallery}
        disabled={locked}
        onAdd={(files) => state.add("IMAGE", files)}
        onRemove={remove("IMAGE")}
        onReorder={(ids) =>
          void state.command(() => reorderBreederMedia("IMAGE", ids), "IMAGE")
        }
      >
        {feedback("IMAGE")}
      </BreederGalleryEditor>
      <BreederVideoEditor
        videos={profile.media.videos}
        disabled={locked}
        onAdd={(url) => state.command(() => addBreederVideo(url), "VIDEO")}
        onEdit={(id, url) =>
          state.command(() => updateBreederVideo(id, url), "VIDEO")
        }
        onRemove={remove("VIDEO")}
        onReorder={(ids) =>
          void state.command(() => reorderBreederMedia("VIDEO", ids), "VIDEO")
        }
      >
        {feedback("VIDEO")}
      </BreederVideoEditor>
    </div>
  );
}
