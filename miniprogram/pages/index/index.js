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

  // 清除所有任务记录
  clearAllTasks() {
    const openid = app.globalData.openid
    if (!openid) return

    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有任务记录吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          wx.request({
            url: `${app.globalData.serverUrl}/api/tasks`,
            method: 'DELETE',
            header: { 'Content-Type': 'application/json' },
            data: { openid },
            success: (res) => {
              if (res.data && res.data.success) {
                wx.showToast({
                  title: res.data.message || '已清除',
                  icon: 'success'
                })
                this.loadTasks()
              } else {
                wx.showToast({
                  title: '清除失败',
                  icon: 'none'
                })
              }
            },
            fail: () => {
              wx.showToast({
                title: '请求失败',
                icon: 'none'
              })
            }
          })
        }
      }
    })
  },

  reSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['3190quZoGppQAekXMUcnLYUwdyG1C7nLgLJmsjoCkcA'],
      success: (subRes) => {
        const accepted = subRes['3190quZoGppQAekXMUcnLYUwdyG1C7nLgLJmsjoCkcA'] === 'accept'

        wx.request({
          url: `${app.globalData.serverUrl}/api/user/subscribe`,
          method: 'POST',
          data: {
            openid: app.globalData.openid,
            subscribed: accepted,
            templateId: '3190quZoGppQAekXMUcnLYUwdyG1C7nLgLJmsjoCkcA'
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
