"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Uploads the file from the browser straight to Supabase Storage, then sends only the details to
 * the server. Netlify functions reject request bodies over ~4 MB, so the file must not pass through
 * a server action. Storage policies still limit uploads to staff who manage this client.
 */
export function DocumentUploadForm({
  clientId,
  categories,
  action,
}: {
  clientId: string;
  categories: readonly string[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      return setError("Choose a file to upload.");
    if (file.size > MAX_BYTES)
      return setError("That file is over the 25 MB limit.");

    setBusy(true);
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
    const path = `${clientId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await createBrowserSupabase()
      .storage.from("client-documents")
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) {
      setBusy(false);
      return setError("The upload failed. Please try again.");
    }

    formData.delete("file");
    formData.set("storage_path", path);
    formData.set("file_name", file.name);
    try {
      await action(formData);
    } catch {
      setBusy(false);
      setError("The file uploaded but could not be saved. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-3 sm:grid-cols-6">
      <h2 className="h-section sm:col-span-6 !mb-0">Upload a document</h2>
      {error && (
        <p
          className="text-sm font-medium text-red-700 sm:col-span-6"
          role="alert"
        >
          {error}
        </p>
      )}
      <div className="sm:col-span-3">
        <label className="label" htmlFor="doc-title">
          Title
        </label>
        <input
          id="doc-title"
          name="title"
          className="input"
          placeholder="Defaults to the file name"
        />
      </div>
      <div className="sm:col-span-3">
        <label className="label" htmlFor="doc-category">
          Category
        </label>
        <select id="doc-category" name="category" className="input">
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-6">
        <label className="label" htmlFor="doc-file">
          File (max 25 MB)
        </label>
        <input
          id="doc-file"
          type="file"
          name="file"
          required
          className="input"
        />
      </div>
      <div className="space-y-1 text-sm sm:col-span-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked /> Visible to
          the client now
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_signed" /> This is the fully signed
          copy (shows a Signed badge)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="notify" defaultChecked /> Email the
          client about this (Sam is CC'd)
        </label>
      </div>
      <div className="flex justify-end sm:col-span-2">
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Uploading..." : "Upload"}
        </button>
      </div>
    </form>
  );
}
