App({
  globalData: {
    systemInfo: null,
    statusBarHeight: 0,
    screenWidth: 0,
    screenHeight: 0,
    safeArea: null,
    permissions: {},
    userInfo: null,
    lastUpdatedMemberId: null,
    cloudInitialized: false
  },
  
  // 事件总线 - 确保在onLaunch之前完全初始化
  eventBus: {
    events: {},
    
    // 注册事件监听
    on: function(eventName, callback) {
      if (!this.events[eventName]) {
        this.events[eventName] = [];
      }
      this.events[eventName].push(callback);
      console.log(`已注册事件监听: ${eventName}, 当前监听器数量: ${this.events[eventName].length}`);
    },
    
    // 触发事件
    emit: function(eventName, data) {
      const eventCallbacks = this.events[eventName];
      if (eventCallbacks && eventCallbacks.length > 0) {
        console.log(`触发事件: ${eventName}, 监听器数量: ${eventCallbacks.length}`);
        eventCallbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`事件处理出错: ${eventName}`, error);
          }
        });
      } else {
        console.log(`触发事件: ${eventName}, 但没有监听器`);
      }
    },
    
    // 移除事件监听
    off: function(eventName, callback) {
      const eventCallbacks = this.events[eventName];
      if (eventCallbacks) {
        if (callback) {
          const index = eventCallbacks.indexOf(callback);
          if (index !== -1) {
            eventCallbacks.splice(index, 1);
            console.log(`已移除事件监听: ${eventName}`);
          }
        } else {
          delete this.events[eventName];
          console.log(`已移除所有 ${eventName} 事件监听`);
        }
      }
    }
  },
  
  onLaunch: function() {
    console.log('启动小程序');
    
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'chilling-4gdawl4ea811c0cd', // 你的云环境ID
        traceUser: true
      });
      
      // 记录云环境初始化状态
      this.globalData.cloudInitialized = true;
      console.log('云开发环境初始化成功: chilling-4gdawl4ea811c0cd');
      
      // 初始化数据库集合
      this.initDatabaseCollections();
      
      // 延迟加载员工信息，确保数据库初始化完成
      setTimeout(() => {
        this.loadStaffInfo();
      }, 1000);
    }
    
    // 检查是否已登录
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const userInfo = wx.getStorageSync('userInfo');
    
    this.globalData = {
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    };
    
    // 初始化全局权限控制
    this.initPermissionControl();
    
    // 获取设备信息
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.globalData.systemInfo = systemInfo;
      this.globalData.statusBarHeight = systemInfo.statusBarHeight;
      this.globalData.screenWidth = systemInfo.screenWidth;
      this.globalData.screenHeight = systemInfo.screenHeight;
      this.globalData.safeArea = systemInfo.safeArea;
    } catch (e) {
      console.error('获取设备信息失败', e);
    }
  },
  
  // 初始化数据库集合
  initDatabaseCollections: function() {
    wx.cloud.callFunction({
      name: 'initDatabase'
    })
    .then(res => {
      console.log('数据库初始化结果:', res);
      // 如果有错误的集合，尝试再次创建
      if (res.result && res.result.results) {
        const results = res.result.results;
        let hasErrors = false;
        
        for (const collection in results) {
          if (results[collection].error) {
            hasErrors = true;
            console.error(`集合 ${collection} 初始化失败:`, results[collection]);
          }
        }
        
        if (hasErrors) {
          console.log('部分集合初始化失败，请检查云开发控制台');
        }
      }
    })
    .catch(err => {
      console.error('数据库初始化失败:', err);
    });
  },
  
  // 加载员工信息
  loadStaffInfo: function() {
    console.log('开始加载员工信息...');
    // 获取用户信息并设置管理员权限
    wx.cloud.callFunction({
      name: 'getStaffInfo',
      data: {
        // 支持预设的员工ID列表，方便测试
        staff_id: wx.getStorageSync('staffId') || 'A' // 默认使用A
      },
      success: res => {
        console.log('获取员工信息成功, 完整响应:', JSON.stringify(res.result));
        if (res.result && res.result.code === 0 && res.result.result) {
          console.log('员工信息有效，保存到本地');
          const staffInfo = {
            ...res.result.result,
            isAdmin: res.result.result.role === 'admin', // 根据角色设置管理员权限
            isStaff: true // 确保设置员工标识
          };
          wx.setStorageSync('staffInfo', staffInfo);
          wx.setStorageSync('staffId', res.result.result.staff_id); // 保存员工ID
          console.log('保存的员工信息:', staffInfo);
        } else {
          console.warn('员工信息获取失败:', res.result.message);
          // 清除可能存在的无效数据
          wx.removeStorageSync('staffInfo');
          wx.removeStorageSync('staffId');
        }
      },
      fail: err => {
        console.error('调用云函数失败:', err);
      }
    });
  },
  
  // 获取当前用户ID
  getUserId: function() {
    const userInfo = wx.getStorageSync('userInfo');
    return userInfo && userInfo._id ? userInfo._id : null;
  },
  
  // 获取当前用户OpenID (云开发中的用户标识)
  getUserOpenId: function() {
    return wx.cloud.getWXContext().OPENID;
  },
  
  // 检查是否登录，但不强制跳转
  isUserLoggedIn: function() {
    return wx.getStorageSync('isLoggedIn') === true;
  },
  
  // 更新用户信息到全局状态
  updateUserInfo: function(userInfo) {
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('userInfo', userInfo);
  },
  
  // 全局权限控制
  initPermissionControl: function() {
    // 定义权限映射表
    this.globalData.permissions = {
      customer: {
        pages: ['index', 'booking', 'service-select', 'orders', 'history', 'member', 'recharge'],
        actions: ['book', 'cancel', 'view_own_orders', 'recharge', 'update_profile']
      },
      staff: {
        pages: ['staff', 'staff-index', 'verification'],
        actions: ['view_all_orders', 'modify_orders', 'verify', 'set_rest_time', 'gift_service']
      },
      admin: {
        pages: ['staff', 'staff-index', 'verification', 'admin'],
        actions: ['view_all_orders', 'modify_orders', 'verify', 'manage_staff', 'manage_services']
      }
    };
  },
  
  // 检查页面访问权限
  checkPagePermission: function(pageName) {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    if (!isLoggedIn) {
      // 修改这里：统一跳转到登录选择页面
      wx.reLaunch({
        url: '/pages/login/login'
      });
      return false;
    }
    const userType = wx.getStorageSync('userType') || 'customer';
    const permissions = this.globalData.permissions[userType];
    if (!permissions || !permissions.pages.includes(pageName)) {
      return false;
    }
    return true;
  },
  
  // 检查操作权限
  checkActionPermission: function(actionName) {
    const userType = wx.getStorageSync('userType') || 'customer';
    const permissions = this.globalData.permissions[userType];
    if (!permissions || !permissions.actions.includes(actionName)) {
      return false;
    }
    return true;
  },
  
  // 检查数据所有权
  checkDataOwnership: function(data) {
    const openid = wx.cloud.getWXContext().OPENID;
    const userType = wx.getStorageSync('userType');
    // 管理员和员工可以访问所有数据
    if (userType === 'admin' || userType === 'staff') {
      return true;
    }
    // 普通用户只能访问自己的数据
    return data.openid === openid;
  },
  
  // 获取事件总线
  getEventBus: function() {
    return this.eventBus;
  },
  
  // 重新初始化云开发环境
  reinitializeCloud: function() {
    console.log('尝试重新初始化云开发环境...');
    if (!wx.cloud) {
      console.error('当前基础库不支持云能力');
      return false;
    }
    
    try {
      wx.cloud.init({
        env: 'chilling-4gdawl4ea811c0cd',
        traceUser: true
      });
      this.globalData.cloudInitialized = true;
      console.log('云开发环境重新初始化成功');
      return true;
    } catch (error) {
      console.error('云开发环境重新初始化失败:', error);
      this.globalData.cloudInitialized = false;
      return false;
    }
  }
});
  