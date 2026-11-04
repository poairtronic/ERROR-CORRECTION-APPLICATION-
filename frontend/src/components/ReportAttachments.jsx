import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/apiClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiPaperclip, 
  FiFileText, 
  FiImage, 
  FiFile, 
  FiTrash2, 
  FiExternalLink 
} from 'react-icons/fi';

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

export default function ReportAttachments({ reportId }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';

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

  // Admin delete mutation
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

  const handleView = (att) => {
    if (!att.fileUrl) return;
    window.open(att.fileUrl, '_blank', 'noopener,noreferrer');
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
          No attachments uploaded for this report.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                <button
                  type="button"
                  onClick={() => handleView(att)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <FiExternalLink /> View
                </button>
                {isAdmin && (
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
    </div>
  );
}
