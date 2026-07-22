const fs = require("fs");
const path = require("path");

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "docs", "_models_extract.json"), "utf8")
);

const slim = data.map((m) => ({
  model: m.model,
  collection: m.collection,
  fieldCount: m.fields.length,
  fields: m.fields.map((f) => ({
    stt: f.stt,
    name: f.name,
    type: f.type,
    length: f.length,
    notnull: f.notnull,
    key: f.key,
    note: f.note,
    relation: f.relation,
  })),
}));

const canvasPath = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "c-Users-quan-Downloads-FastMark-FastMark",
  "canvases",
  "fastmark-database-models.canvas.tsx"
);

const src = `import { useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
} from "cursor/canvas";

const MODELS = ${JSON.stringify(slim)} as const;

export default function FastMarkDatabaseModels() {
  const [modelName, setModelName] = useCanvasState("model", MODELS[0]?.model ?? "User");
  const selected = useMemo(
    () => MODELS.find((m) => m.model === modelName) ?? MODELS[0],
    [modelName]
  );
  const totalFields = MODELS.reduce((sum, m) => sum + m.fieldCount, 0);

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>FastMark Database Models</H1>
        <Text tone="secondary">
          Source: backend/models · Docs: docs/DATABASE_MODELS.md · MongoDB/Mongoose schemas
        </Text>
      </Stack>

      <Grid columns={3} gap={12}>
        <Stat value={String(MODELS.length)} label="Models" />
        <Stat value={String(totalFields)} label="Total fields" />
        <Stat value={String(selected?.fieldCount ?? 0)} label="Fields in selected" />
      </Grid>

      <Card>
        <CardHeader
          title="Chọn model"
          trailing={
            <Pill active tone="neutral">
              {selected?.collection}
            </Pill>
          }
        />
        <CardBody>
          <Select
            value={modelName}
            onChange={setModelName}
            options={MODELS.map((m) => ({
              value: m.model,
              label: m.model + " (" + m.fieldCount + ")",
            }))}
          />
        </CardBody>
      </Card>

      <Divider />

      <Stack gap={8}>
        <Row gap={8} align="center" justify="space-between">
          <H2>{selected?.model}</H2>
          <Text tone="secondary">collection: {selected?.collection}</Text>
        </Row>
        <Table
          headers={["STT", "Name", "Type", "Length", "NotNull", "Key", "Ghi chú", "Quan hệ"]}
          columnAlign={["right", "left", "left", "left", "left", "left", "left", "left"]}
          rows={(selected?.fields ?? []).map((f) => [
            String(f.stt),
            f.name,
            f.type,
            f.length,
            f.notnull,
            f.key,
            f.note,
            f.relation,
          ])}
        />
      </Stack>
    </Stack>
  );
}
`;

fs.writeFileSync(canvasPath, src, "utf8");
console.log("Wrote canvas", canvasPath, "bytes", src.length);
