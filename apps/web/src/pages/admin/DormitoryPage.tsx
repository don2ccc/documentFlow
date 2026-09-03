import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, message } from "antd";
import {
  ApartmentOutlined, HomeOutlined, ShopOutlined, ToolOutlined, IdcardOutlined, DownloadOutlined,
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, DollarOutlined, ThunderboltOutlined, FileTextOutlined
} from "@ant-design/icons";
import {
  Building, Room, Bed, Asset, Resident, DormitoryOverview,
  MeterReading, Bill, BillArrears, BillStatistics, BillStatus,
  RoomType, BedStatus, AssetType, AssetStatus, ResidentStatus,
  dormitoryApi,
  downloadBlob
} from "../../api/endpoints";

const ROOM_TYPES: RoomType[] = ["\u56db\u4eba\u95f4", "\u53cc\u4eba\u95f4", "\u5355\u4eba\u95f4"];
const BED_STATUSES: BedStatus[] = ["\u7a7a\u95f2", "\u5df2\u4f4f", "\u7ef4\u4fee\u4e2d", "\u7981\u7528"];
const ASSET_TYPES: AssetType[] = ["\u7a7a\u8c03", "\u5e8a", "\u67dc\u5b50", "\u70ed\u6c34\u5668", "\u5176\u4ed6"];
const ASSET_STATUSES: AssetStatus[] = ["\u6b63\u5e38", "\u635f\u574f", "\u5df2\u62a5\u5e9f"];
const RESIDENT_STATUSES: ResidentStatus[] = ["\u5728\u4f4f", "\u5df2\u9000\u5bbf"];

const BILL_STATUSES: BillStatus[] = ["\u5f85\u7f34\u8d39", "\u90e8\u5206\u7f34\u8d39", "\u5df2\u7f34\u8d39", "\u903e\u671f", "\u4f5c\u5e9f"];

function billStatusColor(s: BillStatus): string {
  if (s === "\u5df2\u7f34\u8d39") return "green";
  if (s === "\u90e8\u5206\u7f34\u8d39") return "gold";
  if (s === "\u903e\u671f") return "red";
  if (s === "\u4f5c\u5e9f") return "default";
  return "orange";
}

function statusColor(s: string) {
  if (s === "\u5df2\u4f4f" || s === "\u635f\u574f") return "red";
  if (s === "\u7ef4\u4fee\u4e2d") return "orange";
  if (s === "\u7981\u7528" || s === "\u5df2\u9000\u5bbf") return "default";
  return "green";
}

export function DormitoryPage() {
  const [tab, setTab] = useState<"overview"|"buildings"|"rooms"|"beds"|"assets"|"residents"|"meters"|"bills">("overview");
  const [overview, setOverview] = useState<DormitoryOverview | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);

  const refresh = useCallback(async () => {
    const [ov, b, r, bd, a, res] = await Promise.all([
      dormitoryApi.overview(),
      dormitoryApi.listBuildings(),
      dormitoryApi.listRooms(),
      dormitoryApi.listBeds(),
      dormitoryApi.listAssets(),
      dormitoryApi.listResidents()
    ]);
    setOverview(ov); setBuildings(b); setRooms(r); setBeds(bd); setAssets(a); setResidents(res);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Card title="\u5bbf\u820d\u7ba1\u7406" extra={<Button icon={<ReloadOutlined />} onClick={refresh}>\u5237\u65b0</Button>}>
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([
          ["overview", "\u6982\u89c8", <ApartmentOutlined key="i" />],
          ["buildings", "\u697c\u6869\u7ba1\u7406", <HomeOutlined key="i" />],
          ["rooms", "\u623f\u95f4\u7ba1\u7406", <HomeOutlined key="i" />],
          ["beds", "\u5e8a\u4f4d\u7ba1\u7406", <ToolOutlined key="i" />],
          ["assets", "\u8d44\u4ea7\u7ba1\u7406", <ShopOutlined key="i" />],
          ["residents", "\u5165\u4f4f\u767b\u8bb0", <IdcardOutlined key="i" />],
          ["meters", "\u6c34\u7535\u62b5\u8868", <ThunderboltOutlined key="i" />],
          ["bills", "\u8d39\u7528\u7ba1\u7406", <DollarOutlined key="i" />]
        ] as const).map(([k, label, icon]) => (
          <Button key={k} type={tab === k ? "primary" : "default"} icon={icon} onClick={() => setTab(k)}>{label}</Button>
        ))}
      </div>

      {tab === "overview" && overview && <Overview overview={overview} residents={residents} />}
      {tab === "buildings" && <BuildingsTab buildings={buildings} onChanged={refresh} />}
      {tab === "rooms" && <RoomsTab buildings={buildings} rooms={rooms} onChanged={refresh} />}
      {tab === "beds" && <BedsTab rooms={rooms} beds={beds} onChanged={refresh} />}
      {tab === "assets" && <AssetsTab rooms={rooms} assets={assets} onChanged={refresh} />}
      {tab === "residents" && <ResidentsTab residents={residents} beds={beds} onChanged={refresh} />}
      {tab === "meters" && <MeterReadingsTab rooms={rooms} onChanged={refresh} />}
      {tab === "bills" && <BillsTab rooms={rooms} residents={residents} onChanged={refresh} />}
    </Card>
  );
}

function Overview({ overview, residents }: { overview: DormitoryOverview; residents: Resident[]; }) {
  return (
    <div>
      <Row gutter={16}>
        {[
          ["\u697c\u6869\u6570", overview.buildings, "#1677ff"],
          ["\u623f\u95f4\u6570", overview.rooms, "#13c2c2"],
          ["\u5e8a\u4f4d\u603b\u6570", overview.beds, "#722ed1"],
          ["\u5df2\u4f4f\u5e8a\u4f4d", overview.occupiedBeds, "#fa541c"],
          ["\u53ef\u7528\u5e8a\u4f4d", overview.availableBeds, "#52c41a"],
          ["\u5728\u4f4f\u4eba\u5458", overview.residents, "#eb2f96"]
        ].map(([label, val, color]) => (
          <Col span={4} key={String(label)} style={{ marginBottom: 16 }}>
            <Card size="small">
              <div style={{ color: "#888" }}>{String(label)}</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: String(color) }}>{String(val)}</div>
            </Card>
          </Col>
        ))}
      </Row>
      <Card title="\u6700\u8fd1\u5165\u4f4f\u8bb0\u5f55" size="small">
        <Table rowKey="id" size="small" dataSource={residents.slice(0, 10)} pagination={false}
          columns={[
            { title: "\u5de5\u53f7", dataIndex: "employeeNo", width: 100 },
            { title: "\u59d3\u540d", dataIndex: "name", width: 100 },
            { title: "\u90e8\u95e8", dataIndex: "department", width: 140 },
            { title: "\u697c\u6869-\u623f\u95f4", render: (_: unknown, x: Resident) => x.buildingName ? `${x.buildingName} ${x.floor}\u5c42-${x.roomNo}` : "-" },
            { title: "\u5e8a\u4f4d", dataIndex: "bedNo", width: 80 },
            { title: "\u5165\u4f4f\u65e5\u671f", dataIndex: "checkInDate", width: 110 },
            { title: "\u72b6\u6001", dataIndex: "status", width: 80, render: (v: ResidentStatus) => <Tag color={statusColor(v)}>{v}</Tag> }
          ]}
        />
      </Card>
    </div>
  );
}

function BuildingsTab({ buildings, onChanged }: { buildings: Building[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Building | null>(null);
  const [form] = Form.useForm();

  const start = (b?: Building) => { setEditing(b ?? null); form.resetFields(); if (b) form.setFieldsValue(b); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateBuilding(editing.id, v); else await dormitoryApi.createBuilding(v);
    message.success("\u5df2\u4fdd\u5b58"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => { await dormitoryApi.removeBuilding(id); message.success("\u5df2\u5220\u9664"); onChanged(); };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>\u65b0\u5efa\u697c\u6869</Button>
      </Space>
      <Table rowKey="id" dataSource={buildings} pagination={false} size="small"
        columns={[
          { title: "\u697c\u6869\u540d\u79f0", dataIndex: "name", width: 180 },
          { title: "\u5730\u5740", dataIndex: "address" },
          { title: "\u603b\u5c42\u6570", dataIndex: "totalFloors", width: 100 },
          { title: "\u5907\u6ce8", dataIndex: "notes" },
          { title: "\u521b\u5efa\u65f6\u95f4", dataIndex: "createdAt", width: 180, render: (v: string) => v?.slice(0, 16).replace("T", " ") },
          { title: "\u64cd\u4f5c", width: 140, render: (_: unknown, b: Building) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(b)}>\u7f16\u8f91</Button>
              <Popconfirm title="\u786e\u8ba4\u5220\u9664\u8be5\u697c\u6869\uff1f" onConfirm={() => remove(b.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>\u5220\u9664</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "\u7f16\u8f91\u697c\u6869" : "\u65b0\u5efa\u697c\u6869"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="\u540d\u79f0" rules={[{ required: true, max: 80 }]}><Input /></Form.Item>
          <Form.Item name="address" label="\u5730\u5740"><Input /></Form.Item>
          <Form.Item name="totalFloors" label="\u603b\u5c42\u6570" initialValue={1} rules={[{ required: true }]}><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="notes" label="\u5907\u6ce8"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


function RoomsTab({ buildings, rooms, onChanged }: { buildings: Building[]; rooms: Room[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form] = Form.useForm();

  const start = (r?: Room) => { setEditing(r ?? null); form.resetFields(); if (r) form.setFieldsValue(r); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateRoom(editing.id, v); else await dormitoryApi.createRoom(v);
    message.success("\u5df2\u4fdd\u5b58"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => {
    try { await dormitoryApi.removeRoom(id); message.success("\u5df2\u5220\u9664"); onChanged(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "\u5220\u9664\u5931\u8d25"); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>\u65b0\u5efa\u623f\u95f4</Button>
      </Space>
      <Table rowKey="id" dataSource={rooms} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "\u697c\u6869", dataIndex: "buildingId", width: 140, render: (id: string) => buildings.find((b) => b.id === id)?.name ?? id },
          { title: "\u5c42\u6570", dataIndex: "floor", width: 80 },
          { title: "\u623f\u95f4\u53f7", dataIndex: "roomNo", width: 100 },
          { title: "\u7c7b\u578b", dataIndex: "type", width: 100, render: (v: RoomType) => <Tag>{v}</Tag> },
          { title: "\u5e8a\u4f4d\u5360\u7528", width: 120, render: (_: unknown, r: Room) => `${r.bedOccupied ?? 0} / ${r.totalBeds}` },
          { title: "\u5907\u6ce8", dataIndex: "notes" },
          { title: "\u64cd\u4f5c", width: 140, render: (_: unknown, r: Room) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(r)}>\u7f16\u8f91</Button>
              <Popconfirm title="\u786e\u8ba4\u5220\u9664\u8be5\u623f\u95f4\uff1f" onConfirm={() => remove(r.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>\u5220\u9664</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "\u7f16\u8f91\u623f\u95f4" : "\u65b0\u5efa\u623f\u95f4"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="buildingId" label="\u6240\u5c5e\u697c\u6869" rules={[{ required: true }]}>
            <Select options={buildings.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="floor" label="\u5c42\u6570" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="roomNo" label="\u623f\u95f4\u53f7" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="\u623f\u95f4\u7c7b\u578b" rules={[{ required: true }]}>
            <Select options={ROOM_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="totalBeds" label="\u5e8a\u4f4d\u6570\u91cf"><InputNumber min={1} style={{ width: "100%" }} placeholder="\u9ed8\u8ba4\u6309\u623f\u95f4\u7c7b\u578b\u81ea\u52a8\u586b\u5145" /></Form.Item>
          <Form.Item name="notes" label="\u5907\u6ce8"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


function BedsTab({ rooms, beds, onChanged }: { rooms: Room[]; beds: Bed[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bed | null>(null);
  const [form] = Form.useForm();

  const start = (b?: Bed) => { setEditing(b ?? null); form.resetFields(); if (b) form.setFieldsValue(b); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateBed(editing.id, v); else await dormitoryApi.createBed(v);
    message.success("\u5df2\u4fdd\u5b58"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => {
    try { await dormitoryApi.removeBed(id); message.success("\u5df2\u5220\u9664"); onChanged(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "\u5220\u9664\u5931\u8d25"); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>\u65b0\u589e\u5e8a\u4f4d</Button>
      </Space>
      <Table rowKey="id" dataSource={beds} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "\u6240\u5728\u623f\u95f4", dataIndex: "roomId", width: 180, render: (id: string) => { const r = rooms.find((x) => x.id === id); return r ? `${r.floor}\u5c42-${r.roomNo}` : id; } },
          { title: "\u5e8a\u4f4d\u53f7", dataIndex: "bedNo", width: 100 },
          { title: "\u72b6\u6001", dataIndex: "status", width: 100, render: (v: BedStatus) => <Tag color={statusColor(v)}>{v}</Tag> },
          { title: "\u5907\u6ce8", dataIndex: "notes" },
          { title: "\u64cd\u4f5c", width: 160, render: (_: unknown, b: Bed) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(b)}>\u7f16\u8f91</Button>
              <Popconfirm title="\u786e\u8ba4\u5220\u9664\u8be5\u5e8a\u4f4d\uff1f" onConfirm={() => remove(b.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>\u5220\u9664</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "\u7f16\u8f91\u5e8a\u4f4d" : "\u65b0\u589e\u5e8a\u4f4d"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="roomId" label="\u6240\u5728\u623f\u95f4" rules={[{ required: true }]}>
              <Select options={rooms.map((r) => ({ value: r.id, label: `${r.floor}\u5c42-${r.roomNo} (${r.type})` }))} />
            </Form.Item>
          )}
          <Form.Item name="bedNo" label="\u5e8a\u4f4d\u53f7" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="\u72b6\u6001" initialValue="\u7a7a\u95f2">
            <Select options={BED_STATUSES.filter((s) => s !== "\u5df2\u4f4f").map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="notes" label="\u5907\u6ce8"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function AssetsTab({ rooms, assets, onChanged }: { rooms: Room[]; assets: Asset[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [damageOpen, setDamageOpen] = useState(false);
  const [damageAsset, setDamageAsset] = useState<Asset | null>(null);
  const [form] = Form.useForm();
  const [damageForm] = Form.useForm();

  const start = (a?: Asset) => { setEditing(a ?? null); form.resetFields(); if (a) form.setFieldsValue(a); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    if (editing) await dormitoryApi.updateAsset(editing.id, v); else await dormitoryApi.createAsset(v);
    message.success("\u5df2\u4fdd\u5b58"); setOpen(false); onChanged();
  };
  const remove = async (id: string) => { await dormitoryApi.removeAsset(id); message.success("\u5df2\u5220\u9664"); onChanged(); };
  const reportDamage = async () => {
    const v = await damageForm.validateFields();
    if (!damageAsset) return;
    await dormitoryApi.reportDamage(damageAsset.id, v.note ?? "");
    message.success("\u5df2\u4e0a\u62a5\u635f\u574f");
    setDamageOpen(false); setDamageAsset(null); damageForm.resetFields(); onChanged();
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>\u65b0\u589e\u8d44\u4ea7</Button>
      </Space>
      <Table rowKey="id" dataSource={assets} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "\u623f\u95f4", dataIndex: "roomId", width: 160, render: (id: string) => { const r = rooms.find((x) => x.id === id); return r ? `${r.floor}\u5c42-${r.roomNo}` : id; } },
          { title: "\u540d\u79f0", dataIndex: "name", width: 140 },
          { title: "\u7c7b\u578b", dataIndex: "type", width: 90, render: (v: AssetType) => <Tag>{v}</Tag> },
          { title: "\u54c1\u724c", dataIndex: "brand", width: 120 },
          { title: "\u578b\u53f7", dataIndex: "model", width: 120 },
          { title: "\u5e8f\u5217\u53f7", dataIndex: "serialNo", width: 140 },
          { title: "\u8d2d\u4e70\u65e5\u671f", dataIndex: "purchaseDate", width: 110 },
          { title: "\u72b6\u6001", dataIndex: "status", width: 90, render: (v: AssetStatus) => <Tag color={statusColor(v)}>{v}</Tag> },
          { title: "\u635f\u574f\u8bf4\u660e", dataIndex: "damageNote" },
          { title: "\u64cd\u4f5c", width: 220, render: (_: unknown, a: Asset) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(a)}>\u7f16\u8f91</Button>
              <Button size="small" type="link" icon={<ExclamationCircleOutlined />} onClick={() => { setDamageAsset(a); damageForm.resetFields(); setDamageOpen(true); }}>\u635f\u574f\u767b\u8bb0</Button>
              <Popconfirm title="\u786e\u8ba4\u5220\u9664\u8be5\u8d44\u4ea7\uff1f" onConfirm={() => remove(a.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>\u5220\u9664</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "\u7f16\u8f91\u8d44\u4ea7" : "\u65b0\u589e\u8d44\u4ea7"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden>
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="roomId" label="\u6240\u5728\u623f\u95f4" rules={[{ required: true }]}>
              <Select options={rooms.map((r) => ({ value: r.id, label: `${r.floor}\u5c42-${r.roomNo} (${r.type})` }))} />
            </Form.Item>
          )}
          <Form.Item name="name" label="\u540d\u79f0" rules={[{ required: true }]}><Input placeholder="\u4f8b\uff1a1\u53f7\u7a7a\u8c03" /></Form.Item>
          <Form.Item name="type" label="\u7c7b\u578b" rules={[{ required: true }]}>
            <Select options={ASSET_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="brand" label="\u54c1\u724c"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="model" label="\u578b\u53f7"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="serialNo" label="\u5e8f\u5217\u53f7"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="purchaseDate" label="\u8d2d\u4e70\u65e5\u671f"><Input type="date" /></Form.Item></Col>
          </Row>
          <Form.Item name="status" label="\u72b6\u6001" initialValue="\u6b63\u5e38">
            <Select options={ASSET_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="damageNote" label="\u635f\u574f\u8bf4\u660e"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
      <Modal open={damageOpen} title={"\u635f\u574f\u767b\u8bb0\uff1a" + (damageAsset?.name ?? "")} onCancel={() => setDamageOpen(false)} onOk={reportDamage} destroyOnHidden>
        <Form form={damageForm} layout="vertical">
          <Form.Item name="note" label="\u635f\u574f\u63cf\u8ff0" rules={[{ required: true }]}><Input.TextArea rows={3} placeholder="\u8bf7\u63cf\u8ff0\u635f\u574f\u90e8\u4f4d\u3001\u7a0b\u5ea6\u3001\u5df2\u91c7\u53d6\u7684\u63aa\u65bd\u7b49" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


function ResidentsTab({ residents, beds, onChanged }: { residents: Resident[]; beds: Bed[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Resident | null>(null);
  const [form] = Form.useForm();

  const availableBeds = useMemo(() => beds.filter((b) => b.status === "\u7a7a\u95f2" || (editing && b.id === editing.bedId)), [beds, editing]);

  const start = (r?: Resident) => { setEditing(r ?? null); form.resetFields(); if (r) form.setFieldsValue(r); setOpen(true); };
  const save = async () => {
    const v = await form.validateFields();
    try {
      if (editing) await dormitoryApi.updateResident(editing.id, v);
      else await dormitoryApi.createResident(v);
      message.success("\u5df2\u4fdd\u5b58"); setOpen(false); onChanged();
    } catch (e: any) { message.error(e?.response?.data?.message ?? "\u4fdd\u5b58\u5931\u8d25"); }
  };
  const remove = async (id: string) => {
    try { await dormitoryApi.removeResident(id); message.success("\u5df2\u5220\u9664"); onChanged(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "\u5220\u9664\u5931\u8d25"); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => start()}>\u65b0\u589e\u5165\u4f4f\u8bb0\u5f55</Button>
        <Button icon={<DownloadOutlined />} onClick={async () => {
          try {
            const blob = await dormitoryApi.exportResidents();
            const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
            downloadBlob(blob, `宿舍人员台账_${ts}.csv`);
            message.success("已导出宿舍人员名单");
          } catch (e: any) { message.error(e?.message ?? "导出失败"); }
        }}>\u4e00\u952e\u5bfc\u51fa\u4eba\u5458\u540d\u5355</Button>
      </Space>
      <Table rowKey="id" dataSource={residents} pagination={{ pageSize: 20 }} size="small"
        columns={[
          { title: "\u5de5\u53f7", dataIndex: "employeeNo", width: 100 },
          { title: "\u59d3\u540d", dataIndex: "name", width: 100 },
          { title: "\u90e8\u95e8", dataIndex: "department", width: 140 },
          { title: "\u624b\u673a", dataIndex: "phone", width: 120 },
          { title: "\u5165\u804c\u65e5\u671f", dataIndex: "hireDate", width: 110 },
          { title: "\u697c\u6869-\u623f\u95f4", width: 180, render: (_: unknown, r: Resident) => r.buildingName ? `${r.buildingName} ${r.floor}\u5c42-${r.roomNo}` : "-" },
          { title: "\u5e8a\u4f4d", dataIndex: "bedNo", width: 80 },
          { title: "\u5165\u4f4f\u65e5", dataIndex: "checkInDate", width: 110 },
          { title: "\u9000\u5bbf\u65e5", dataIndex: "checkOutDate", width: 110 },
          { title: "\u9000\u5bbf\u7269\u54c1\u67e5\u9a8c", dataIndex: "checkOutItemsCheck", width: 160, ellipsis: true },
          { title: "\u7ed3\u7b97\u8d39\u7528", dataIndex: "checkOutSettlement", width: 100, align: "right", render: (v: string | null) => v ? Number(v).toFixed(2) : "-" },
          { title: "\u72b6\u6001", dataIndex: "status", width: 90, render: (v: ResidentStatus) => <Tag color={statusColor(v)}>{v}</Tag> },
          { title: "\u64cd\u4f5c", width: 140, render: (_: unknown, r: Resident) => (
            <Space>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => start(r)}>\u7f16\u8f91</Button>
              <Popconfirm title="\u786e\u8ba4\u5220\u9664\u8be5\u5165\u4f4f\u8bb0\u5f55\uff1f" onConfirm={() => remove(r.id)}>
                <Button size="small" type="link" danger icon={<DeleteOutlined />}>\u5220\u9664</Button>
              </Popconfirm>
            </Space>
          ) }
        ]}
      />
      <Modal open={open} title={editing ? "\u7f16\u8f91\u5165\u4f4f\u8bb0\u5f55" : "\u65b0\u589e\u5165\u4f4f\u8bb0\u5f55"} onCancel={() => setOpen(false)} onOk={save} destroyOnHidden width={640}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="employeeNo" label="\u5de5\u53f7" rules={[{ required: true }]}><Input disabled={!!editing} /></Form.Item></Col>
            <Col span={12}><Form.Item name="name" label="\u59d3\u540d" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="department" label="\u90e8\u95e8"><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label="\u624b\u673a"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="hireDate" label="\u5165\u804c\u65e5\u671f"><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="bedId" label="\u5206\u914d\u5e8a\u4f4d"><Select allowClear options={availableBeds.map((b) => ({ value: b.id, label: `${b.bedNo} \u5f53\u524d\u7a7a\u95f2` }))} placeholder="\u9009\u62e9\u7a7a\u95f2\u5e8a\u4f4d\u540e\u81ea\u52a8\u6807\u4e3a\u5df2\u4f4f" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="checkInDate" label="\u5165\u4f4f\u65e5\u671f" rules={[{ required: true }]}><Input type="date" /></Form.Item></Col>
            <Col span={12}><Form.Item name="checkOutDate" label="\u9000\u5bbf\u65e5\u671f"><Input type="date" placeholder="\u672a\u9000\u5bbf\u7559\u7a7a" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="checkOutItemsCheck" label="\u9000\u5bbf\u7269\u54c1\u67e5\u9a8c"><Input.TextArea rows={2} placeholder="\u4f8b\uff1a\u94a5\u53192\u628a/\u7535\u53611\u5f20/\u5e8a\u57ab\u5b8c\u597d" /></Form.Item></Col>
            <Col span={12}><Form.Item name="checkOutSettlement" label="\u9000\u5bbf\u7ed3\u7b97\u8d39\u7528"><InputNumber min={0} step={0.01} style={{ width: "100%" }} placeholder="\u5143" /></Form.Item></Col>
          </Row>
          <Form.Item name="status" label="\u72b6\u6001" initialValue="\u5728\u4f4f">
            <Select options={RESIDENT_STATUSES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
          <Form.Item name="notes" label="\u5907\u6ce8"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}


// ===================== 抄表 =====================
function MeterReadingsTab({ rooms, onChanged }: { rooms: Room[]; onChanged: () => void }) {
  const [list, setList] = useState<MeterReading[]>([]);
  const [period, setPeriod] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MeterReading | null>(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    const data = await dormitoryApi.listMeterReadings(undefined, period || undefined);
    setList(data);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      period: new Date().toISOString().slice(0, 7),
      readingDate: new Date().toISOString().slice(0, 10),
      recordedBy: ""
    });
    setOpen(true);
  };

  const openEdit = (r: MeterReading) => {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue({
      ...r,
      electricReading: Number(r.electricReading),
      waterReading: Number(r.waterReading),
      publicElectricUsage: Number(r.publicElectricUsage),
      publicWaterUsage: Number(r.publicWaterUsage)
    });
    setOpen(true);
  };

  const submit = async () => {
    const values = await form.validateFields();
    const body = { ...values };
    if (editing) {
      await dormitoryApi.updateMeterReading(editing.id, body);
      message.success("\u5df2\u66f4\u65b0");
    } else {
      await dormitoryApi.recordMeterReading(body);
      message.success("\u5df2\u5f55\u5165");
    }
    setOpen(false);
    load();
    onChanged();
  };

  return (
    <div>
      <Space style={{ marginBottom: 12 }} wrap>
        <Input placeholder="\u8d26\u671f (YYYY-MM)" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} />
        <Button onClick={load}>\u67e5\u8be2</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>\u65b0\u589e\u62b5\u8868</Button>
      </Space>
      <Table rowKey="id" size="small" dataSource={list} pagination={{ pageSize: 20 }}>
        <Table.Column title="\u623f\u95f4" dataIndex="roomId" width={120}
          render={(rid) => {
            const r = rooms.find((x) => x.id === rid);
            return r ? r.roomNo + "\u8f66\u4e0a\u5c42" + r.floor : rid.slice(0, 6);
          }} />
        <Table.Column title="\u8d26\u671f" dataIndex="period" width={100} />
        <Table.Column title="\u7535\u8868\u8bfb\u6570" dataIndex="electricReading" width={110} align="right" />
        <Table.Column title="\u7535\u7528\u91cf" dataIndex="electricUsage" width={110} align="right" />
        <Table.Column title="\u6c34\u8868\u8bfb\u6570" dataIndex="waterReading" width={110} align="right" />
        <Table.Column title="\u6c34\u7528\u91cf" dataIndex="waterUsage" width={110} align="right" />
        <Table.Column title="\u516c\u644a\u7535" dataIndex="publicElectricUsage" width={100} align="right" />
        <Table.Column title="\u516c\u644a\u6c34" dataIndex="publicWaterUsage" width={100} align="right" />
        <Table.Column title="\u62b5\u8868\u65e5\u671f" dataIndex="readingDate" width={120} />
        <Table.Column title="\u62b5\u8868\u4eba" dataIndex="recordedBy" width={100} />
        <Table.Column title="\u5907\u6ce8" dataIndex="notes" />
        <Table.Column title="\u64cd\u4f5c" width={150} fixed="right"
          render={(_, r: MeterReading) => (
            <Space>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>\u7f16\u8f91</Button>
              <Popconfirm title="\u786e\u8ba4\u5220\u9664\uff1f" onConfirm={async () => { await dormitoryApi.removeMeterReading(r.id); message.success("\u5df2\u5220\u9664"); load(); }}>
                <Button size="small" danger icon={<DeleteOutlined />}>\u5220\u9664</Button>
              </Popconfirm>
            </Space>
          )} />
      </Table>
      <Modal title={editing ? "\u7f16\u8f91\u62b5\u8868" : "\u65b0\u589e\u62b5\u8868"} open={open} onCancel={() => setOpen(false)} onOk={submit} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="roomId" label="\u623f\u95f4" rules={[{ required: true }]}>
            <Select placeholder="\u9009\u62e9\u623f\u95f4" options={rooms.map((r) => ({ value: r.id, label: r.buildingName ? r.buildingName + " / " + r.roomNo + " (" + r.floor + "\u5c42)" : r.roomNo }))} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="period" label="\u8d26\u671f (YYYY-MM)" rules={[{ required: true, pattern: /^\d{4}-\d{2}$/ }]}>
            <Input placeholder="2026-09" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="electricReading" label="\u7535\u8868\u8bfb\u6570 (\u5ea6)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="waterReading" label="\u6c34\u8868\u8bfb\u6570 (\u5428)" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="publicElectricUsage" label="\u516c\u644a\u7535\u7528\u91cf" initialValue={0}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="publicWaterUsage" label="\u516c\u644a\u6c34\u7528\u91cf" initialValue={0}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
          </Row>
          <Form.Item name="readingDate" label="\u62b5\u8868\u65e5\u671f" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="recordedBy" label="\u62b5\u8868\u4eba"><Input /></Form.Item>
          <Form.Item name="notes" label="\u5907\u6ce8"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ===================== 账单 =====================
function BillsTab({ residents, onChanged }: { rooms: Room[]; residents: Resident[]; onChanged: () => void }) {
  const [list, setList] = useState<Bill[]>([]);
  const [arrears, setArrears] = useState<BillArrears[]>([]);
  const [stats, setStats] = useState<BillStatistics | null>(null);
  const [period, setPeriod] = useState<string>("");
  const [genOpen, setGenOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<(Bill | BillArrears) | null>(null);
  const [genForm] = Form.useForm();
  const [payForm] = Form.useForm();

  const load = useCallback(async () => {
    const [b, arr, st] = await Promise.all([
      dormitoryApi.listBills({ period: period || undefined }),
      dormitoryApi.arrearsList(),
      dormitoryApi.billStatistics(period || undefined)
    ]);
    setList(b); setArrears(arr); setStats(st);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const onGenerate = async () => {
    const values = await genForm.validateFields();
    const res = await dormitoryApi.generateBills(values);
    message.success("\u5df2\u751f\u6210 " + res.generated + " \u5f20\u8d26\u5355\uff08\u8df3\u8fc7 " + res.skipped + " \u5f20\u5df2\u5b58\u5728\uff09");
    setGenOpen(false);
    load();
    onChanged();
  };

  const onPay = async () => {
    if (!payTarget) return;
    const values = await payForm.validateFields();
    await dormitoryApi.markBillPaid(payTarget.id, values.paidAmount, values.notes);
    message.success("\u5df2\u7f34\u8d39");
    setPayTarget(null);
    load();
    onChanged();
  };

  const openPay = (b: Bill | BillArrears) => {
    setPayTarget(b);
    payForm.resetFields();
    const remain = Number(b.totalAmount) - Number(b.paidAmount);
    payForm.setFieldsValue({ paidAmount: remain > 0 ? Number(remain.toFixed(2)) : 0 });
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {stats ? ([
          ["\u8d26\u5355\u7b14\u6570", stats.billCount, "#1677ff"],
          ["\u5e94\u6536\u603b\u989d", stats.totalAmount.toFixed(2) + " \u5143", "#13c2c2"],
          ["\u5df2\u6536\u603b\u989d", stats.paidAmount.toFixed(2) + " \u5143", "#52c41a"],
          ["\u6b20\u6b3e\u603b\u989d", stats.arrears.toFixed(2) + " \u5143", "#ff4d4f"]
        ] as const).map(([k, v, color]) => (
          <Col span={6} key={k as string}>
            <Card size="small"><div style={{ color: "#888" }}>{k}</div><div style={{ color, fontSize: 22, fontWeight: 600 }}>{v}</div></Card>
          </Col>
        )) : null}
      </Row>

      {arrears.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, borderColor: "#ff4d4f" }} title={<span style={{ color: "#ff4d4f" }}>\u26a0 \u7d2f\u8ba1 {arrears.length} \u7b14\u672a\u7f34\u6b3e\u8d26\u5355\uff0c\u7b97\u4e0a\u672a\u6536\u91d1\u989d {arrears.reduce((s, a) => s + (a.arrears || 0), 0).toFixed(2)} \u5143</span>}>
          <Table rowKey="id" size="small" dataSource={arrears.slice(0, 10)} pagination={false}>
            <Table.Column title="\u8d26\u671f" dataIndex="period" width={100} />
            <Table.Column title="\u5458\u5de5" width={140}
              render={(_, a: BillArrears) => a.resident ? (a.resident.name + " (" + a.resident.employeeNo + ")") : "-"} />
            <Table.Column title="\u90e8\u95e8" width={120}
              render={(_, a: BillArrears) => a.resident?.department ?? "-"} />
            <Table.Column title="\u4f4f\u6240" width={160}
              render={(_, a: BillArrears) => a.resident?.bed ? (a.resident.bed.room?.building?.name + " / " + a.resident.bed.room?.roomNo + " / " + a.resident.bed.bedNo) : "-"} />
            <Table.Column title="\u5e94\u4ed8" dataIndex="totalAmount" width={100} align="right" />
            <Table.Column title="\u5df2\u4ed8" dataIndex="paidAmount" width={100} align="right" />
            <Table.Column title="\u6b20\u6b3e" width={100} align="right"
              render={(_, a: BillArrears) => <span style={{ color: "#ff4d4f", fontWeight: 600 }}>{(a.arrears ?? 0).toFixed(2)}</span>} />
            <Table.Column title="\u72b6\u6001" dataIndex="status" width={100}
              render={(_, a: BillArrears) => <Tag color={billStatusColor(a.status)}>{a.status}</Tag>} />
            <Table.Column title="\u64cd\u4f5c" width={100}
              render={(_, a: BillArrears) => (
                <Button size="small" type="primary" onClick={() => openPay(a as Bill | BillArrears)}>\u7f34\u8d39</Button>
              )} />
          </Table>
        </Card>
      )}

      <Space style={{ marginBottom: 12 }} wrap>
        <Input placeholder="\u8d26\u671f (YYYY-MM)" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} />
        <Button onClick={load}>\u67e5\u8be2</Button>
        <Button icon={<DownloadOutlined />} onClick={async () => {
          try {
            const blob = await dormitoryApi.exportBills({ period: period || undefined });
            const ts = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
            downloadBlob(blob, `宿舍账单_${period || "全部"}_${ts}.csv`);
            message.success("已导出财务报表");
          } catch (e: any) { message.error(e?.message ?? "导出失败"); }
        }}>\u5bfc\u51fa\u8d22\u52a1\u62a5\u8868</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          genForm.resetFields();
          genForm.setFieldsValue({
            period: new Date().toISOString().slice(0, 7),
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
            electricRate: 0.6, waterRate: 4.0, roomRate: 0
          });
          setGenOpen(true);
        }}>\u751f\u6210\u8d26\u5355</Button>
      </Space>
      <Table rowKey="id" size="small" dataSource={list} pagination={{ pageSize: 20 }}>
        <Table.Column title="\u8d26\u671f" dataIndex="period" width={100} />
        <Table.Column title="\u5458\u5de5" width={140}
          render={(_, b: Bill) => b.resident ? (b.resident.name + " (" + b.resident.employeeNo + ")") : "-"} />
        <Table.Column title="\u90e8\u95e8" width={120}
          render={(_, b: Bill) => b.resident?.department ?? "-"} />
        <Table.Column title="\u7535\u8d39" dataIndex="electricFee" width={100} align="right" />
        <Table.Column title="\u6c34\u8d39" dataIndex="waterFee" width={100} align="right" />
        <Table.Column title="\u4f4f\u5bbf\u8d39" dataIndex="roomFee" width={100} align="right" />
        <Table.Column title="\u5408\u8ba1" dataIndex="totalAmount" width={110} align="right" />
        <Table.Column title="\u5df2\u4ed8" dataIndex="paidAmount" width={110} align="right" />
        <Table.Column title="\u72b6\u6001" dataIndex="status" width={110}
          render={(_, b: Bill) => <Tag color={billStatusColor(b.status)}>{b.status}</Tag>} />
        <Table.Column title="\u622a\u6b62" dataIndex="dueDate" width={110} />
        <Table.Column title="\u64cd\u4f5c" width={180} fixed="right"
          render={(_, b: Bill) => (
            <Space>
              {b.status !== "\u5df2\u7f34\u8d39" && b.status !== "\u4f5c\u5e9f" && (
                <Button size="small" type="primary" onClick={() => openPay(b)}>\u7f34\u8d39</Button>
              )}
              {b.status !== "\u5df2\u7f34\u8d39" && (
                <Popconfirm title="\u786e\u8ba4\u4f5c\u5e9f\uff1f" onConfirm={async () => { await dormitoryApi.voidBill(b.id); message.success("\u5df2\u4f5c\u5e9f"); load(); onChanged(); }}>
                  <Button size="small" danger>\u4f5c\u5e9f</Button>
                </Popconfirm>
              )}
            </Space>
          )} />
      </Table>

      <Modal title="\u751f\u6210\u8d26\u5355" open={genOpen} onCancel={() => setGenOpen(false)} onOk={onGenerate}>
        <Form form={genForm} layout="vertical">
          <Form.Item name="period" label="\u8d26\u671f (YYYY-MM)" rules={[{ required: true, pattern: /^\d{4}-\d{2}$/ }]}><Input /></Form.Item>
          <Form.Item name="electricRate" label="\u7535\u4ef7 (\u5143/\u5ea6)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="waterRate" label="\u6c34\u4ef7 (\u5143/\u5428)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="roomRate" label="\u4f4f\u5bbf\u8d39 (\u5143/\u4eba/\u6708)" rules={[{ required: true }]}><InputNumber min={0} step={1} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="dueDate" label="\u7f34\u8d39\u622a\u6b62\u65e5" rules={[{ required: true }]}><Input type="date" /></Form.Item>
          <Form.Item name="notes" label="\u5907\u6ce8"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="\u7f34\u8d39\u767b\u8bb0" open={!!payTarget} onCancel={() => setPayTarget(null)} onOk={onPay}>
        {payTarget && (
          <div>
            <p>\u5458\u5de5\uff1a<strong>{payTarget.resident?.name}</strong> ({payTarget.resident?.employeeNo})</p>
            <p>\u8d26\u671f\uff1a<strong>{payTarget.period}</strong></p>
            <p>\u5e94\u4ed8\uff1a<strong>{Number(payTarget.totalAmount).toFixed(2)}</strong> \u5143\uff0c\u5df2\u4ed8 {Number(payTarget.paidAmount).toFixed(2)} \u5143\uff0c\u672c\u6b21\u53ef\u7f34\u4e0d\u8d85\u8fc7 {(Number(payTarget.totalAmount) - Number(payTarget.paidAmount)).toFixed(2)} \u5143</p>
            <Form form={payForm} layout="vertical">
              <Form.Item name="paidAmount" label="\u672c\u6b21\u7f34\u8d39\u91d1\u989d" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{ width: "100%" }} /></Form.Item>
              <Form.Item name="notes" label="\u5907\u6ce8"><Input.TextArea rows={2} /></Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}
