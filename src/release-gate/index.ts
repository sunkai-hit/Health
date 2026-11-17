/** Release gate. This is deliberately NOT a deployable Health API.
 * Default Wrangler config points here so accidental deployment cannot enable
 * synthetic identities or allow storage of real patient information.
 * Remove this gate only after explicit identity, encryption, legal and release reviews.
 */
const CLOSED_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'x-frame-options':'DENY'
};
const handler:ExportedHandler={
  fetch():Response {
    return new Response(JSON.stringify({
      error:{code:'RELEASE_BLOCKED',message:'Health 正式环境未开放；身份及数据安全阶段门尚未完成'}
    }),{status:503,headers:CLOSED_HEADERS});
  }
};
export default handler;
