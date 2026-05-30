import { useRef, useState } from 'react';

/** MIME type filter applied to the hidden file input. */
const ACCEPTED_TYPES = '.csv,.pdf,.hy3';

/** An Interface for the props accepted by the `FileUpload` component. */
interface FileUploadProps {
  /**
   * Callback invoked when the user selects or drops a file.
   * Only the first file is passed if multiple files are provided.
   *
   * @param file - The raw browser `File` object to be parsed by the caller.
   */
  onFile: (file: File) => void;
}

/**
 * Renders a styled drop zone that accepts file input via drag-and-drop or
 * a click-to-browse file picker.
 *
 * Logic flow:
 * 1. The visible `<div>` acts as the drop target and click handler.
 * 2. A hidden `<input type="file">` is programmatically clicked when the div
 *    is clicked, opening the OS file picker.
 * 3. Both the drag-and-drop and file picker paths funnel through `handleFiles`,
 *    which extracts the first file and invokes `onFile`.
 * 4. `dragging` state drives the visual highlight while a file is held over the zone.
 *
 * @param props - See {@link FileUploadProps}.
 */
export function FileUpload({ onFile }: FileUploadProps) {
  // Ref to the hidden <input> so we can trigger the OS file picker programmatically
  const inputRef = useRef<HTMLInputElement>(null);

  // Tracks whether a drag is currently hovering over the drop zone (for visual feedback)
  const [dragging, setDragging] = useState(false);

  /**
   * Extracts the first file from a `FileList` and passes it to the parent callback.
   * Only the first file is used; multi-file drops are silently truncated.
   *
   * @param files - The `FileList` from a drop event or input change event.
   */
  function handleFiles(files: FileList | null) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <div
      // Prevent default browser behaviour (opening the file) on drag-over
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      // On drop: suppress default, clear drag state, and process the dropped file
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      // Clicking the div delegates to the hidden file input
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? '#1976d2' : '#aaa'}`,
        borderRadius: 8,
        padding: '2rem',
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? '#e3f2fd' : '#fafafa',
        transition: 'all 0.2s',
      }}
    >
      <p>Drag & drop a file here, or click to browse</p>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>Supported: CSV, PDF, HY3</p>

      {/* Hidden input &mdash;exists only to trigger the OS file picker on click */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
