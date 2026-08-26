import { useEffect, useState } from 'react';
import { Modal, Select, message } from 'antd';
import { documentsApi, workflowsApi, WorkflowItem } from '../api/endpoints';

export function SubmitFlowModal({ documentId, open, onClose, onSuccess }: { documentId: string; open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [selected, setSelected] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      workflowsApi.list({ status: 'active' }).then(setWorkflows).catch(() => undefined);
      setSelected(undefined);
    }
  }, [open]);

  const submit = async () => {
    if (!selected) {
      message.warning('请选择审批流程');
      return;
    }
    setLoading(true);
    try {
      await documentsApi.submit(documentId, selected);
      message.success('已提交审批');
      onSuccess();
    } catch (e: any) {
      message.error(e?.response?.data?.message ?? '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="选择审批流程" open={open} onOk={submit} onCancel={onClose} confirmLoading={loading} destroyOnClose>
      <Select
        style={{ width: '100%' }}
        placeholder="选择已启用的审批流程"
        value={selected}
        onChange={setSelected}
        options={workflows.map((w) => ({ value: w.id, label: `${w.name}（${w.nodeCount} 个节点）` }))}
      />
    </Modal>
  );
}