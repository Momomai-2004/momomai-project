Page({
  data: {
    staffName: '员工',
    staffInfo: null,
    isAdmin: false
  },
  
  onLoad: function() {
    console.log('员工页面加载');
    this.loadStaffInfo();
  },
  
  onShow: function() {
    // 刷新员工信息显示
    this.loadStaffInfo();
  },
  
  // 加载员工信息
  loadStaffInfo: function() {
    // 先检查员工登录状态
    const isStaffLoggedIn = wx.getStorageSync('isStaffLoggedIn');
    if (!isStaffLoggedIn) {
      console.warn('员工未登录');
      this.redirectToLogin('员工未登录，请先登录');
      return;
    }
    
    // 获取员工信息
    const staffInfo = wx.getStorageSync('staffInfo');
    console.log('获取到的员工信息:', staffInfo);
    
    if (staffInfo && staffInfo.name && staffInfo.staff_id) {
      this.setData({
        staffName: staffInfo.name,
        staffInfo: staffInfo,
        isAdmin: staffInfo.isAdmin || staffInfo.role === 'admin'
      });
      console.log('员工信息已设置:', this.data.staffName, '是否管理员:', this.data.isAdmin);
    } else {
      console.warn('未找到员工信息或信息不完整');
      this.redirectToLogin('员工信息不完整，请重新登录');
    }
  },
  
  // 重定向到登录页面
  redirectToLogin: function(message) {
    // 清除无效的登录状态
    wx.removeStorageSync('staffInfo');
    wx.removeStorageSync('isStaffLoggedIn');
    wx.removeStorageSync('staffId');
    
    wx.showModal({
      title: '提示',
      content: message || '请登录员工账号',
      showCancel: false,
      success: (res) => {
        if (res.confirm) {
          // 设置自动跳转标记
          wx.setStorageSync('autoRedirectStaffLogin', true);
          
          wx.redirectTo({
            url: '/pages/login/staff/staff',
            success: () => {
              console.log('已跳转到员工登录页');
            },
            fail: (err) => {
              console.error('跳转到员工登录页失败:', err);
            }
          });
        }
      }
    });
  },
  
  // 查看预约列表
  viewBookings: function() {
    wx.navigateTo({
      url: '/pages/manage-appointments/manage-appointments'
    });
  },
  
  // 管理会员
  manageMembers: function() {
    wx.navigateTo({
      url: '/pages/manage-members/manage-members'
    });
  },
  
  // 设置休息时间
  setRestTime: function() {
    wx.navigateTo({
      url: '/pages/set-rest-time/set-rest-time'
    });
  },
  
  // 赠送项目
  giftService: function() {
    wx.navigateTo({
      url: '/pages/gift-service/gift-service'
    });
  },
  
  // 退出登录
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出员工账号吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除员工登录状态
          wx.removeStorageSync('staffInfo');
          wx.removeStorageSync('isStaffLoggedIn');
          wx.removeStorageSync('staffId');
          wx.removeStorageSync('userType');
          
          // 跳转到员工登录页
          wx.redirectTo({
            url: '/pages/login/staff/staff'
          });
        }
      }
    });
  }
});
  