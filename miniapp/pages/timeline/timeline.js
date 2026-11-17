/**
 * Completely synthetic, read-only sample bundled at build time.
 * No user data, no local storage, no wx.request and no wx.login.
 */
Page({
  data:{
    events:[{
      id:'demo-event-001',
      title:'虚构示例：一次短暂不适',
      onset:'发生时间：虚构示例，未确认',
      status:'仅用于界面演示',
      entries:[
        {id:'demo-entry-001',title:'用户自述',location:'身体位置：未确定',text:'示例记录：有短暂不舒服的感觉；没有推断具体疾病。'},
        {id:'demo-entry-002',title:'症状变化',location:'时间：未知',text:'示例记录：稍后感觉有所变化。仅演示时间线展示方式。'}
      ]
    }]
  }
});
