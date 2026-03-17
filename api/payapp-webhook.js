// =====================================================
//  페이앱 feedbackurl 웹훅 핸들러 (Vercel 서버리스)
//  엔드포인트: POST /api/payapp-webhook
// =====================================================
import { kv } from '@vercel/kv';

export default async function handler(req, res) {

  // ── GET: 결제 확인 (HTML 폴링용) ──────────────────
  if (req.method === 'GET') {
    const { session } = req.query;
    if (!session) return res.status(400).json({ paid: false });

    try {
      const val = await kv.get(`paid:${session}`);
      if (val) return res.status(200).json({ paid: true, mul_no: val });
      return res.status(200).json({ paid: false });
    } catch (e) {
      return res.status(200).json({ paid: false, error: e.message });
    }
  }

  // ── POST: 페이앱 서버 → 결제 완료 통보 ────────────
  if (req.method === 'POST') {
    const body = req.body || {};

    // 보안 검증
    const PAYAPP_USERID  = process.env.PAYAPP_USERID;
    const PAYAPP_LINKKEY = process.env.PAYAPP_LINKKEY;
    const PAYAPP_LINKVAL = process.env.PAYAPP_LINKVAL;
    const ORDER_PRICE    = process.env.ORDER_PRICE || '990';

    const ok = (!PAYAPP_USERID  || body.userid  === PAYAPP_USERID)
            && (!PAYAPP_LINKKEY || body.linkkey === PAYAPP_LINKKEY)
            && (!PAYAPP_LINKVAL || body.linkval === PAYAPP_LINKVAL)
            && (!ORDER_PRICE    || String(body.price) === String(ORDER_PRICE));

    if (!ok) {
      console.error('[Webhook] 보안 검증 실패', { userid: body.userid, price: body.price });
      return res.status(200).send('FAIL');
    }

    const pay_state = String(body.pay_state || '');
    const mul_no    = body.mul_no || '';
    const sessionId = body.var1  || '';

    // 결제 완료(pay_state=4)
    if (pay_state === '4' && sessionId) {
      try {
        await kv.set(`paid:${sessionId}`, mul_no, { ex: 86400 });
        console.log(`[Webhook] 결제 완료 ✅ session=${sessionId} mul_no=${mul_no}`);
      } catch (e) {
        console.error('[Webhook] KV 저장 실패', e.message);
      }
    }

    return res.status(200).send('SUCCESS');
  }

  return res.status(405).send('Method Not Allowed');
}
