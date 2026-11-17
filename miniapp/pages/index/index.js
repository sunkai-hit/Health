Page({
  data: {
    isSynthetic:true,
    title:'Health 健康记录',
    capabilities:[
      '健康事件及症状时间线',
      '人体位置与症状变化（后续接入）',
      '就医记录与医嘱（后续阶段）'
    ]
  },
  openTimeline(){
    wx.navigateTo({url:'/pages/timeline/timeline'});
  },
  openCloudDev(){
    wx.navigateTo({url:'/pages/dev-cloud/dev-cloud'});
  }
});
