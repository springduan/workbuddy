// app.js
App({
  globalData: {
    userInfo: null,
    openid: null,
    role: null, // 'driver' 司机 | 'salesperson' 业务员
    serverUrl: 'http://127.0.0.1:3000' // 开发时用本机IP
  },

  onLaunch() {
    // 检查本地是否已有登录信息
    const userInfo = wx.getStorageSync('userInfo')
    const openid = wx.getStorageSync('openid')
    const role = wx.getStorageSync('role')
    if (userInfo && openid && role) {
      this.globalData.userInfo = userInfo
      this.globalData.openid = openid
      this.globalData.role = role
    }
  }
})
