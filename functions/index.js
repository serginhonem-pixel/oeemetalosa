const admin = require('firebase-admin');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');

admin.initializeApp();

const TELHA_OEE_SA_JSON = defineSecret('TELHA_OEE_SA_JSON');

const getTelhaApp = () => {
  const existing = admin.apps.find((app) => app.name === 'telha-oee');
  if (existing) return existing;

  const raw = TELHA_OEE_SA_JSON.value();
  if (!raw) {
    throw new Error('TELHA_OEE_SA_JSON nao configurado.');
  }

  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.TELHA_OEE_PROJECT_ID || serviceAccount.project_id,
    },
    'telha-oee'
  );
};

const getTelhaDb = () => getTelhaApp().firestore();

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

const normalizeCode = (value) => String(value || '').trim();

const applySaldoDelta = async ({ code, name, delta }) => {
  if (!code || !delta) return;

  const ref = getTelhaDb().collection('slitterStock').doc(code);
  const payload = {
    cod: code,
    saldoQtd: admin.firestore.FieldValue.increment(delta),
    origem: 'SLITTER',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (name) {
    payload.productName = String(name);
  }

  await ref.set(payload, { merge: true });
};

const handleDelta = async ({
  before,
  after,
  qtyField,
}) => {
  const beforeData = before?.exists ? before.data() : null;
  const afterData = after?.exists ? after.data() : null;

  const code = normalizeCode(afterData?.productCode || beforeData?.productCode);
  if (!code) return;

  const beforeQty = toNumber(beforeData?.[qtyField]);
  const afterQty = toNumber(afterData?.[qtyField]);
  const delta = afterQty - beforeQty;
  if (!delta) return;

  const name = afterData?.productName || beforeData?.productName || '';
  await applySaldoDelta({ code, name, delta });
};

exports.syncSlitterProduction = onDocumentWritten(
  {
    document: 'productionLogs/{docId}',
    secrets: [TELHA_OEE_SA_JSON],
  },
  async (event) => {
    try {
      await handleDelta({
        before: event.data?.before,
        after: event.data?.after,
        qtyField: 'pieces',
      });
    } catch (err) {
      logger.error('Erro ao sincronizar productionLogs:', err);
    }
  }
);

exports.syncSlitterShipping = onDocumentWritten(
  {
    document: 'shippingLogs/{docId}',
    secrets: [TELHA_OEE_SA_JSON],
  },
  async (event) => {
    try {
      await handleDelta({
        before: event.data?.before,
        after: event.data?.after,
        qtyField: 'quantity',
      });
    } catch (err) {
      logger.error('Erro ao sincronizar shippingLogs:', err);
    }
  }
);
