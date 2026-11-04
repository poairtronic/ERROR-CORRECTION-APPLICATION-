import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { 
  FiPaperclip, 
  FiFileText, 
  FiImage, 
  FiFile, 
  FiUploadCloud, 
  FiTrash2, 
  FiExternalLink, 
  FiX 
} from 'react-icons/fi';

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'];
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(fileType, mimeType) {
  if (fileType === 'pdf' || mimeType === 'application/pdf') {
    return <FiFileText style={{ color: '#ef4444', fontSize: 20 }} />;
  }
  if (fileType === 'image' || mimeType?.startsWith('image/')) {
    return <FiImage style={{ color: '#3b82f6', fontSize: 20 }} />;
  }
  return <FiFile style={{ color: '#8b5cf6', fontSize: 20 }} />;
}

export default function ReportAttachments({ reportId, canUpload = false }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch attachments list
  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['report-attachments', reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const res = await api.get(`/defect-reports/${reportId}/attachments`);
      return res.data || [];
    },
    enabled: !!reportId,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/defect-reports/${reportId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('File uploaded successfully');
      setSelectedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['report-attachments', reportId] });
    },
    onError: (err) => {
      const msg = err.response?.data?.message || err.message || 'Failed to upload file';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
      setUploadProgress(0);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (attachmentId) => {
      const res = await api.delete(`/defect-reports/${reportId}/attachments/${attachmentId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Attachment deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['report-attachments', reportId] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete attachment');
    },
  });

  const validateAndSetFile = (file) => {
    if (!file) return;

    // Check size (max 10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('File too large (maximum allowed size is 10 MB)');
      return;
    }

    // Check type
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    const isMimeValid = ALLOWED_MIME_TYPES.includes(file.type);
    const isExtValid = ALLOWED_EXTENSIONS.includes(ext);

    if (!isMimeValid && !isExtValid) {
      toast.error('File type not allowed. Accepted: PDF, Images (JPG, PNG), Word documents.');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    validateAndSetFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    validateAndSetFile(file);
  };

  const handleUploadClick = () => {
    if (!selectedFile) return;
    uploadMutation.mutate(selectedFile);
  };

  const handleClearSelected = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="card no-print" style={{ marginTop: 20 }}>
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FiPaperclip />
          <span>Attachments & Documents ({attachments.length})</span>
        </div>
      </div>

      {/* Attachments List */}
      {isLoading ? (
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13 }}>Loading attachments…</div>
      ) : attachments.length === 0 ? (
        <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
          No attachments uploaded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: canUpload ? 20 : 0 }}>
          {attachments.map((att) => (
            <div
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 6, background: 'var(--bg-card)' }}>
                  {getFileIcon(att.fileType, att.mimeType)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.originalName || att.fileName}>
                    {att.originalName || att.fileName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatBytes(att.fileSizeBytes)} · Uploaded {new Date(att.uploadedAt || att.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  <FiExternalLink /> View
                </a>
                {canUpload && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete attachment "${att.originalName || att.fileName}"?`)) {
                        deleteMutation.mutate(att.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="btn btn-ghost btn-sm"
                    style={{ color: '#ef4444' }}
                    title="Delete attachment"
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone (Only if canUpload) */}
      {canUpload && (
        <div style={{ marginTop: attachments.length > 0 ? 16 : 0, borderTop: attachments.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: attachments.length > 0 ? 16 : 0 }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
          />

          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? '#3b82f6' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg)',
                transition: 'all 0.2s ease',
              }}
            >
              <FiUploadCloud style={{ fontSize: 32, color: isDragging ? '#3b82f6' : 'var(--text-muted)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Click to browse or drag and drop files here
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Accepted: PDF, Images (JPG, PNG, WEBP), Word documents. Max 10MB per file.
              </div>
            </div>
          ) : (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 16,
                background: 'var(--bg)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  {getFileIcon('', selectedFile.type)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatBytes(selectedFile.size)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    disabled={uploadMutation.isPending}
                    className="btn btn-primary btn-sm"
                    style={{ minWidth: 80 }}
                  >
                    {uploadMutation.isPending ? `Uploading (${uploadProgress}%)` : 'Upload'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    disabled={uploadMutation.isPending}
                    className="btn btn-ghost btn-sm"
                    title="Cancel selection"
                  >
                    <FiX />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {uploadMutation.isPending && (
                <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: '#3b82f6',
                      width: `${uploadProgress}%`,
                      transition: 'width 0.2s ease',
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
