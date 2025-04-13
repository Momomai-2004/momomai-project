Page({
  data: {
    userId: '',
    userInfo: null,
    nickName: '',
    phone: '',
    walletBalance: 0,
    remainingTimes: 0,
    // 新增服务项目次数
    basicTimes60: 0,
    basicTimes90: 0,
    advancedTimes60: 0,
    advancedTimes90: 0,
    loading: false
  },

  onLoad(options) {
    // 确保云环境初始化
    const app = getApp();
    if (app && app.globalData && !app.globalData.cloudInitialized) {
      console.log('云环境未初始化，尝试重新初始化');
      app.reinitializeCloud();
    }
    
    if (options.userId) {
      this.setData({
        userId: options.userId
      });
      this.loadUserInfo(options.userId);
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none',
        success: () => {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      });
    }
  },

  // 加载会员信息
  loadUserInfo(userId) {
    this.setData({ loading: true });
    
    const db = wx.cloud.database();
    
    db.collection('users')
      .doc(userId)
      .get()
      .then(res => {
        const userInfo = res.data;
        
        // 获取服务项目次数详情，若不存在则初始化为0
        if (!userInfo.service_times) {
          // 使用云函数初始化service_times字段
          wx.cloud.callFunction({
            name: 'initServiceTimes',
            data: {
              userId: userInfo._id
            }
          }).then(() => {
            console.log('service_times初始化成功');
            wx.showToast({
              title: '数据已刷新',
              icon: 'success'
            });
          }).catch(err => {
            console.error('初始化service_times失败:', err);
          });
          
          userInfo.service_times = {
            basic_60: 0,
            basic_90: 0,
            advanced_60: 0,
            advanced_90: 0
          };
        }
        
        const serviceTimes = userInfo.service_times;
        
        this.setData({
          userInfo,
          nickName: userInfo.nickName || '',
          phone: userInfo.phone || '',
          walletBalance: userInfo.wallet_balance || 0,
          remainingTimes: userInfo.remaining_times || 0,
          // 设置各项目次数
          basicTimes60: serviceTimes.basic_60 || 0,
          basicTimes90: serviceTimes.basic_90 || 0,
          advancedTimes60: serviceTimes.advanced_60 || 0,
          advancedTimes90: serviceTimes.advanced_90 || 0,
          loading: false
        });
        
        // 隐藏加载提示
        if (wx.hideLoading) {
          wx.hideLoading();
        }
      })
      .catch(err => {
        console.error('获取会员信息失败:', err);
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
        this.setData({ loading: false });
        
        // 确保在错误情况下也隐藏加载提示
        if (wx.hideLoading) {
          wx.hideLoading();
        }
      });
  },

  // 输入昵称
  inputNickName(e) {
    this.setData({
      nickName: e.detail.value
    });
  },

  // 输入手机号
  inputPhone(e) {
    this.setData({
      phone: e.detail.value
    });
  },

  // 输入钱包余额
  inputWalletBalance(e) {
    const value = e.detail.value;
    // 确保输入的是有效数字
    if (!isNaN(value)) {
      this.setData({
        walletBalance: parseFloat(value)
      });
    }
  },

  // 输入基础服务60分钟次数
  inputBasicTimes60(e) {
    const value = e.detail.value;
    if (!isNaN(value)) {
      this.setData({
        basicTimes60: parseInt(value)
      });
      this.updateTotalTimes();
    }
  },

  // 输入基础服务90分钟次数
  inputBasicTimes90(e) {
    const value = e.detail.value;
    if (!isNaN(value)) {
      this.setData({
        basicTimes90: parseInt(value)
      });
      this.updateTotalTimes();
    }
  },

  // 输入高级服务60分钟次数
  inputAdvancedTimes60(e) {
    const value = e.detail.value;
    if (!isNaN(value)) {
      this.setData({
        advancedTimes60: parseInt(value)
      });
      this.updateTotalTimes();
    }
  },

  // 输入高级服务90分钟次数
  inputAdvancedTimes90(e) {
    const value = e.detail.value;
    if (!isNaN(value)) {
      this.setData({
        advancedTimes90: parseInt(value)
      });
      this.updateTotalTimes();
    }
  },

  // 输入剩余次数
  inputRemainingTimes(e) {
    const value = e.detail.value;
    if (!isNaN(value)) {
      this.setData({
        remainingTimes: parseInt(value)
      });
    }
  },

  // 更新总次数
  updateTotalTimes() {
    const { basicTimes60, basicTimes90, advancedTimes60, advancedTimes90 } = this.data;
    const total = basicTimes60 + basicTimes90 + advancedTimes60 + advancedTimes90;
    this.setData({
      remainingTimes: total
    });
  },

  // 保存会员信息
  saveUserInfo() {
    // 先验证表单
    if (!this.validateForm()) {
      return;
    }
    
    const { 
      userId, nickName, phone, walletBalance, remainingTimes,
      basicTimes60, basicTimes90, advancedTimes60, advancedTimes90
    } = this.data;
    
    // 检查员工权限
    const staffInfo = wx.getStorageSync('staffInfo');
    console.log('当前员工信息:', JSON.stringify(staffInfo));
    
    if (!staffInfo || !staffInfo._id) {
      wx.showModal({
        title: '权限错误',
        content: '请先登录员工账号',
        showCancel: false
      });
      return;
    }
    
    this.setData({ loading: true });
    wx.showLoading({ title: '保存中...', mask: true });
    
    // 准备更新数据
    const newInfo = {
      nickName: nickName,
      phone: phone,
      wallet_balance: walletBalance,
      remaining_times: remainingTimes,
      // 添加服务项目次数
      service_times: {
        basic_60: basicTimes60,
        basic_90: basicTimes90,
        advanced_60: advancedTimes60,
        advanced_90: advancedTimes90
      }
    };
    
    // 构造更完整的员工信息
    const staffData = {
      _id: staffInfo._id,
      name: staffInfo.name || '员工',
      is_staff: true,
      role: staffInfo.role || 'staff'
    };
    
    console.log('准备更新会员信息，数据:', {
      userId,
      newInfo,
      staffInfo: staffData
    });
    
    // 确保云函数环境已初始化
    if (!wx.cloud) {
      console.error('云开发环境未初始化');
      wx.showModal({
        title: '系统错误',
        content: '云开发环境未初始化，请重启小程序',
        showCancel: false
      });
      this.setData({ loading: false });
      wx.hideLoading();
      return;
    }
    
    // 使用云函数更新会员信息
    wx.cloud.callFunction({
      name: 'updateMemberInfo',
      data: {
        userId: userId,
        newInfo: newInfo,
        staffInfo: staffData
      }
    })
    .then(res => {
      console.log('云函数调用成功，返回数据:', res);
      
      if (res.result && res.result.success) {
        // 更新成功
        console.log('会员数据已成功同步到云数据库');
        
        // 更新本地缓存和通知其他页面
        this.updateLocalUserInfo();
        this.notifyRefresh(userId);
        
        wx.showToast({ 
          title: '更新成功', 
          icon: 'success' 
        });
        
        setTimeout(() => {
          wx.navigateBack({
            success: () => {
              // 尝试触发前一页的刷新
              const pages = getCurrentPages();
              const prevPage = pages[pages.length - 2];
              if (prevPage && typeof prevPage.reloadData === 'function') {
                prevPage.reloadData();
              }
            }
          });
        }, 1500);
      } else {
        // 更新失败
        const errMsg = (res.result && res.result.message) ? res.result.message : '更新会员信息失败，请稍后重试';
        console.error('云函数返回错误:', res.result);
        
        wx.showModal({
          title: '更新失败',
          content: errMsg,
          showCancel: false
        });
      }
    })
    .catch(err => {
      console.error('云函数调用失败:', err);
      
      wx.showModal({
        title: '系统错误',
        content: '调用云函数失败，请检查网络连接后重试',
        showCancel: false
      });
    })
    .finally(() => {
      // 清除加载状态
      this.setData({ loading: false });
      wx.hideLoading();
    });
  },

  // 重置修改
  resetChanges() {
    const { userInfo } = this.data;
    if (userInfo) {
      const serviceTimes = userInfo.service_times || {
        basic_60: 0,
        basic_90: 0,
        advanced_60: 0,
        advanced_90: 0
      };
      
      this.setData({
        nickName: userInfo.nickName || '',
        phone: userInfo.phone || '',
        walletBalance: userInfo.wallet_balance || 0,
        remainingTimes: userInfo.remaining_times || 0,
        basicTimes60: serviceTimes.basic_60 || 0,
        basicTimes90: serviceTimes.basic_90 || 0,
        advancedTimes60: serviceTimes.advanced_60 || 0,
        advancedTimes90: serviceTimes.advanced_90 || 0
      });
    }
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack();
  },

  // 添加强制刷新数据的按钮处理函数
  reloadUserData() {
    if (this.data.userId) {
      wx.showLoading({
        title: '刷新数据中...',
      });
      
      this.loadUserInfo(this.data.userId);
    }
  },

  // 在提交表单前的验证方法中修改
  validateForm() {
    const { nickName, phone } = this.data;
    
    if (!nickName || nickName.trim() === '') {
      wx.showToast({
        title: '请输入会员姓名',
        icon: 'none'
      });
      return false;
    }
    
    if (!phone || phone.trim() === '') {
      wx.showToast({
        title: '请输入手机号或账号',
        icon: 'none'
      });
      return false;
    }
    
    // 如果输入的是手机号，可以保留格式验证
    // 如果是纯数字且长度为11位，视为手机号并验证格式
    if (/^\d{11}$/.test(phone) && !/^1\d{10}$/.test(phone)) {
      wx.showToast({
        title: '手机号格式不正确',
        icon: 'none'
      });
      return false;
    }
    
    return true;
  },

  // 更新本地缓存的用户信息
  updateLocalUserInfo() {
    const { userId, nickName, phone, walletBalance, remainingTimes, basicTimes60, basicTimes90, advancedTimes60, advancedTimes90 } = this.data;
    
    console.log('准备更新本地用户信息，数据:', {
      userId,
      nickName,
      phone,
      walletBalance,
      remainingTimes,
      basicTimes60,
      basicTimes90,
      advancedTimes60,
      advancedTimes90
    });
    
    // 检查当前登录的用户信息
    const loginUserInfo = wx.getStorageSync('userInfo');
    console.log('当前登录用户信息:', loginUserInfo);
    
    let updated = false;
    
    // 1. 更新全局变量中的会员信息
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.lastUpdatedMemberId = userId;
      // 如果全局变量中有会员信息且ID匹配，也更新它
      if (app.globalData.userInfo && app.globalData.userInfo._id === userId) {
        console.log('更新全局变量中的会员信息');
        app.globalData.userInfo = {
          ...app.globalData.userInfo,
          nickName,
          phone,
          wallet_balance: walletBalance,
          remaining_times: remainingTimes,
          service_times: {
            basic_60: basicTimes60,
            basic_90: basicTimes90,
            advanced_60: advancedTimes60,
            advanced_90: advancedTimes90
          }
        };
        updated = true;
      }
    }
    
    // 2. 更新本地存储中的会员信息
    // 只有当前编辑的是登录用户时才更新本地缓存
    if (loginUserInfo && loginUserInfo._id === userId) {
      console.log('当前编辑的是登录用户，更新本地缓存');
      
      // 合并原有信息和更新信息
      const updatedUserInfo = {
        ...loginUserInfo,
        nickName,
        phone,
        wallet_balance: walletBalance,
        remaining_times: remainingTimes,
        service_times: {
          basic_60: basicTimes60,
          basic_90: basicTimes90,
          advanced_60: advancedTimes60,
          advanced_90: advancedTimes90
        }
      };
      
      console.log('更新后的会员信息:', updatedUserInfo);
      
      // 更新本地存储
      wx.setStorageSync('userInfo', updatedUserInfo);
      
      updated = true;
    } else {
      console.log('当前编辑的不是登录用户，无需更新本地缓存');
      console.log('loginUserInfo._id:', loginUserInfo ? loginUserInfo._id : 'null');
      console.log('userId:', userId);
    }
    
    // 3. 强制刷新相关页面的数据
    try {
      // 安全地触发全局事件
      if (app && typeof app.getEventBus === 'function') {
        const eventBus = app.getEventBus();
        eventBus.emit('memberInfoUpdated', {
          memberId: userId,
          isCurrentUser: updated,
          timestamp: new Date().getTime(),
          data: {
            nickName,
            phone,
            wallet_balance: walletBalance,
            remaining_times: remainingTimes,
            service_times: {
              basic_60: basicTimes60,
              basic_90: basicTimes90,
              advanced_60: advancedTimes60,
              advanced_90: advancedTimes90
            }
          }
        });
        console.log('已触发memberInfoUpdated事件');
      } else {
        console.warn('无法获取eventBus，无法触发事件');
      }
    } catch (error) {
      console.error('触发事件出错:', error);
    }
    
    return updated;
  },

  // 通知其他页面刷新
  notifyRefresh(userId) {
    console.log('通知其他页面刷新用户信息:', userId);
    
    // 通过globalData标记数据已更新
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.memberDataUpdated = true;
      app.globalData.lastUpdatedMemberId = userId;
      app.globalData.lastUpdateTime = new Date().getTime();
    }
    
    // 触发全局事件，通知其他页面刷新
    if (app && typeof app.getEventBus === 'function') {
      const eventBus = app.getEventBus();
      const { nickName, phone, walletBalance, remainingTimes, basicTimes60, basicTimes90, advancedTimes60, advancedTimes90 } = this.data;
      
      // 构造更新数据
      const updateData = {
        memberId: userId,
        isCurrentUser: userId === (wx.getStorageSync('userInfo') || {})._id,
        timestamp: new Date().getTime(),
        data: {
          nickName,
          phone,
          wallet_balance: walletBalance,
          remaining_times: remainingTimes,
          service_times: {
            basic_60: basicTimes60,
            basic_90: basicTimes90,
            advanced_60: advancedTimes60,
            advanced_90: advancedTimes90
          }
        }
      };
      
      // 触发更新事件
      eventBus.emit('memberInfoUpdated', updateData);
      
      // 触发用户列表刷新事件
      eventBus.emit('refreshMembersList', { timestamp: new Date().getTime() });
      
      console.log('已发送刷新事件通知');
    }
  }
})