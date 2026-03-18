import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const query = req.query || {};
  const body = req.body || {};

  // 폴링용: session 파라미터만 있고 pay_state 없으면 결제 확인
  if (req.method === 'GET' && query.session && !query.pay_state) {
    try {
      const val = await kv.get(`paid:${query.session}`);
      if (val) return res.status(200).json({ paid: true, mul_no: val });
      return res.status(200).json({ paid: false });
    } catch (e) {
      return res.status(200).json({ paid: false, error: e.message });
    }
  }

  // 페이앱 feedbackurl 웹훅: GET 또는 POST, pay_state=4 이면 결제완료
  const pay_state = String(query.pay_state || body.pay_state || '');
  const mul_no    = query.mul_no    || body.mul_no    || '';
  const sessionId = query.var1      || body.var1      || '';

  if (pay_state === '4' && sessionId) {
    try {
      await kv.set(`paid:${sessionId}`, mul_no || 'paid', { ex: 86400 });
    } catch (e) {
      // KV 저장 실패해도 SUCCESS 반환 (페이앱 재시도 방지)
      console.error('KV error:', e.message);
    }
  }

  // 페이앱은 반드시 "SUCCESS" 텍스트 응답을 기대함
  res.setHeader('Content-Type', 'text/plain');
  return res.status(200).send('SUCCESS');
}
