// pages/index/index.js
const app = getApp()

Page({
  data: {
    userInfo: null,
    nameInitial: '',
    roleText: '',
    tasks: [],
    todayCount: 0,
    totalCount: 0
  },

  onLoad() {
    // 检查登录状态
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo')
    const openid = app.globalData.openid || wx.getStorageSync('openid')
    const role = app.globalData.role || wx.getStorageSync('role')

    if (!userInfo || !openid) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }

    app.globalData.userInfo = userInfo
    app.globalData.openid = openid
    app.globalData.role = role

    const roleText = role === 'driver' ? '司机' : '业务员'
    const nameInitial = userInfo.name ? userInfo.name.slice(-1) : '用'

    this.setData({ userInfo, roleText, nameInitial })
    this.loadTasks()
  },

  onShow() {
    this.loadTasks()
  },

  loadTasks() {
    const openid = app.globalData.openid
    if (!openid) return

    wx.request({
      url: `${app.globalData.serverUrl}/api/tasks`,
      method: 'GET',
      data: { openid },
      success: (res) => {
        if (res.data && res.data.success) {
          const tasks = res.data.data || []
          const today = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')
          const todayCount = tasks.filter(t => t.date === today).length

          this.setData({
            tasks,
            todayCount,
            totalCount: tasks.length
          })
        }
      },
      fail: (err) => {
        console.error('加载任务失败', err)
      }
    })
  },

  reSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['_axfOU8CQJtAnrHzkPlen7G0myB1KHeDqV-CdcTiIEI'],
      success: (subRes) => {
        const accepted = subRes['_axfOU8CQJtAnrHzkPlen7G0myB1KHeDqV-CdcTiIEI'] === 'accept'

        wx.request({
          url: `${app.globalData.serverUrl}/api/user/subscribe`,
          method: 'POST',
          data: {
            openid: app.globalData.openid,
            subscribed: accepted,
            templateId: '_axfOU8CQJtAnrHzkPlen7G0myB1KHeDqV-CdcTiIEI'
          },
          success: () => {
            wx.showToast({
              title: accepted ? '已开启通知' : '已关闭通知',
              icon: accepted ? 'success' : 'none'
            })
          },
          fail: (err) => {
            console.error('设置订阅失败', err)
          }
        })
      },
      fail: (err) => {
        console.error('订阅消息失败', err)
      }
    })
  }
})
