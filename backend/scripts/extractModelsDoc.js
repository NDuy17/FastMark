const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "models");

function mongooseType(schemaType) {
  if (!schemaType) return "Mixed";
  const iname = schemaType.instance || "";
  if (schemaType.instance === "Array" || schemaType.$isMongooseArray) {
    const caster = schemaType.caster;
    if (caster) return "Array<" + mongooseType(caster) + ">";
    return "Array";
  }
  if (iname === "ObjectID" || iname === "ObjectId") return "ObjectId";
  if (iname === "String") return "String";
  if (iname === "Number") return "Number";
  if (iname === "Boolean") return "Boolean";
  if (iname === "Date") return "Date";
  if (iname === "Mixed") return "Mixed";
  return iname || "Mixed";
}

function lengthOf(schemaType, typeName) {
  if (typeName === "ObjectId") return "24";
  if (schemaType?.options?.maxlength != null) return String(schemaType.options.maxlength);
  if (schemaType?.options?.maxLength != null) return String(schemaType.options.maxLength);
  if (
    typeName === "Number" &&
    schemaType?.options?.min != null &&
    schemaType?.options?.max != null
  ) {
    return schemaType.options.min + ".." + schemaType.options.max;
  }
  if (typeName === "Number" && schemaType?.options?.max != null) {
    return "max:" + schemaType.options.max;
  }
  return "-";
}

function keyOf(pathName, schemaType, schema) {
  const keys = [];
  if (pathName === "_id") keys.push("PK");
  if (schemaType?.options?.unique) keys.push("UNIQUE");
  if (schemaType?.options?.index) keys.push("INDEX");
  const indexes = schema.indexes?.() || [];
  for (const [fields] of indexes) {
    if (fields && Object.prototype.hasOwnProperty.call(fields, pathName)) {
      if (!keys.includes("INDEX")) keys.push("INDEX");
    }
  }
  return keys.length ? keys.join(", ") : "-";
}

function relationOf(schemaType) {
  const ref = schemaType?.options?.ref || schemaType?.caster?.options?.ref;
  if (!ref) return "-";
  return "N-1 → " + ref;
}

function notesOf(schemaType) {
  const bits = [];
  if (schemaType?.options?.default !== undefined) {
    const d = schemaType.options.default;
    if (typeof d === "function") bits.push("default: fn");
    else bits.push("default: " + JSON.stringify(d));
  }
  if (schemaType?.options?.enum) bits.push("enum: " + JSON.stringify(schemaType.options.enum));
  if (schemaType?.options?.trim) bits.push("trim");
  if (schemaType?.options?.min != null) bits.push("min:" + schemaType.options.min);
  if (schemaType?.options?.max != null) bits.push("max:" + schemaType.options.max);
  return bits.join("; ") || "-";
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const all = [];

for (const f of files) {
  const full = path.resolve(dir, f);
  const before = new Set(mongoose.modelNames());
  let mod;
  try {
    delete require.cache[full];
    mod = require(full);
  } catch (e) {
    console.error("ERR", f, e.message);
    continue;
  }
  const after = mongoose.modelNames().filter((n) => !before.has(n));
  let model = null;
  if (mod && mod.modelName && mod.schema) model = mod;
  else if (after.length) model = mongoose.model(after[after.length - 1]);
  if (!model || !model.schema) {
    console.error("SKIP", f);
    continue;
  }

  const schema = model.schema;
  const fields = [];
  fields.push({
    stt: 1,
    name: "_id",
    type: "ObjectId",
    length: "24",
    notnull: "YES",
    key: "PK",
    note: "MongoDB primary key (tự sinh)",
    relation: "-",
  });
  let stt = 2;
  for (const pathName of Object.keys(schema.paths).sort()) {
    if (pathName === "_id" || pathName === "__v") continue;
    const st = schema.paths[pathName];
    const typeName = mongooseType(st);
    const required = Boolean(st.isRequired || st.options?.required);
    fields.push({
      stt: stt++,
      name: pathName,
      type: typeName,
      length: lengthOf(st, typeName),
      notnull: required ? "YES" : "NO",
      key: keyOf(pathName, st, schema),
      note: notesOf(st),
      relation: relationOf(st),
    });
  }
  const indexNotes = (schema.indexes() || []).map(([fieldsObj, opts]) => {
    return Object.keys(fieldsObj).join(",") + (opts?.unique ? " UNIQUE" : "");
  });
  all.push({
    model: model.modelName,
    collection: model.collection.collectionName,
    file: "backend/models/" + f,
    fields,
    indexes: indexNotes,
  });
}

const outDir = path.join(__dirname, "..", "docs");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "_models_extract.json"), JSON.stringify(all, null, 2));
console.log("models", all.length);
console.log(all.map((m) => m.model + ":" + m.fields.length).join("\n"));
