const app = getApp();

Page({
  data: {
    isLoggedIn: false,  // 默认未登录
    walletBalance: 0,
    remainingSessions: 0,
    userInfo: null,
    basic60Packages: [
      { sessions: 4, price: 1028, average: 257, discount: 86 },
      { sessions: 12, price: 2878, average: 240, discount: 80 },
      { sessions: 24, price: 5258, average: 219, discount: 73 }
    ],
    basic90Packages: [
      { sessions: 4, price: 1518, average: 379, discount: 86 },
      { sessions: 12, price: 2878, average: 352, discount: 80 },
      { sessions: 24, price: 5258, average: 321, discount: 73 }
    ],
    advanced60Packages: [
      { sessions: 4, price: 1378, average: 344, discount: 86 },
      { sessions: 12, price: 3838, average: 320, discount: 80 },
      { sessions: 24, price: 6998, average: 292, discount: 73 }
    ],
    advanced90Packages: [
      { sessions: 4, price: 1998, average: 499, discount: 86 },
      { sessions: 12, price: 5568, average: 464, discount: 80 },
      { sessions: 24, price: 10148, average: 423, discount: 73 }
    ],
    showRemainingModal: false,
    basic60Count: 0,
    basic90Count: 0,
    advanced60Count: 0,
    advanced90Count: 0
  },

  onLoad() {
    this.loadUserInfo();
    
    // 检查并自动更新已支付订单状态
    this.checkAndUpdatePaidOrders();
    
    // 注册监听会员信息更新事件
    const app = getApp();
    
    // 使用getEventBus方法获取事件总线
    if (app && typeof app.getEventBus === 'function') {
      const eventBus = app.getEventBus();
      
      this.memberInfoUpdateListener = (data) => {
        if (data.isCurrentUser) {
          console.log('接收到会员信息更新事件，刷新页面:', data);
          
          // 如果事件中包含完整数据，直接更新
          if (data.data && data.data.remaining_times !== undefined) {
            console.log('使用事件中的数据直接更新页面');
            
            // 从事件中获取各服务次数
            let basic60 = 0, basic90 = 0, advanced60 = 0, advanced90 = 0;
            
            if (data.data.service_times) {
              basic60 = data.data.service_times.basic_60 || 0;
              basic90 = data.data.service_times.basic_90 || 0;
              advanced60 = data.data.service_times.advanced_60 || 0;
              advanced90 = data.data.service_times.advanced_90 || 0;
            }
            
            // 获取本地存储中的用户信息，并更新
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo) {
              // 更新用户信息
              const updatedUserInfo = {
                ...userInfo,
                nickName: data.data.nickName || userInfo.nickName,
                phone: data.data.phone || userInfo.phone,
                wallet_balance: data.data.wallet_balance,
                remaining_times: data.data.remaining_times,
                service_times: {
                  basic_60: basic60,
                  basic_90: basic90,
                  advanced_60: advanced60,
                  advanced_90: advanced90
                }
              };
              
              // 更新本地存储
              wx.setStorageSync('userInfo', updatedUserInfo);
              
              // 更新页面数据
              this.setData({
                userInfo: updatedUserInfo,
                walletBalance: updatedUserInfo.wallet_balance || 0,
                remainingSessions: updatedUserInfo.remaining_times || 0,
                basic60Count: basic60,
                basic90Count: basic90,
                advanced60Count: advanced60,
                advanced90Count: advanced90
              });
              
              console.log('会员页面数据已直接更新:', this.data);
            } else {
              // 如果本地没有用户信息，则通过常规方式加载
              this.loadUserInfo();
            }
          } else {
            // 如果事件中没有完整数据，则通过常规方式加载
            this.loadUserInfo();
          }
        }
      };
      
      eventBus.on('memberInfoUpdated', this.memberInfoUpdateListener);
    } else {
      console.warn('获取eventBus失败，无法注册事件监听');
    }
  },

  onShow() {
    // 检查是否已经恢复过数据
    const dataRestored = wx.getStorageSync('dataRestored');
    if (!dataRestored) {
      this.loadUserInfo();
    } else {
      console.log('页面显示时检测到数据已恢复，避免重复加载');
    }
  },

  // 加载用户信息而不做登录检查
  loadUserInfo() {
    // 检查是否已经恢复过数据，避免循环加载
    const dataRestored = wx.getStorageSync('dataRestored');
    if (dataRestored) {
      console.log('数据已经恢复过，不再重复查询');
      // 清除恢复标记，让下次onShow能正常加载
      wx.removeStorageSync('dataRestored');
      return;
    }
    
    // 从缓存中获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    
    if (userInfo) {
      console.log('从本地缓存加载用户信息:', userInfo);
      
      // 如果缓存中有用户信息，获取服务次数
      let basic60 = 0, basic90 = 0, advanced60 = 0, advanced90 = 0;
      
      if (userInfo.service_times) {
        // 优先使用新格式数据
        console.log('使用service_times格式数据:', userInfo.service_times);
        basic60 = userInfo.service_times.basic_60 || 0;
        basic90 = userInfo.service_times.basic_90 || 0;
        advanced60 = userInfo.service_times.advanced_60 || 0;
        advanced90 = userInfo.service_times.advanced_90 || 0;
      } else {
        // 兼容旧格式数据
        console.log('使用旧格式数据');
        basic60 = userInfo.basic60Count || 0;
        basic90 = userInfo.basic90Count || 0;
        advanced60 = userInfo.advanced60Count || 0;
        advanced90 = userInfo.advanced90Count || 0;
      }
      
      // 直接从本地缓存更新页面数据
      this.setData({
        isLoggedIn: true,
        userInfo,
        walletBalance: userInfo.wallet_balance || 0,
        remainingSessions: userInfo.remaining_times || 0,
        basic60Count: basic60,
        basic90Count: basic90,
        advanced60Count: advanced60,
        advanced90Count: advanced90
      });
      
      console.log('会员页面数据已从本地缓存更新:', {
        walletBalance: userInfo.wallet_balance || 0,
        remainingSessions: userInfo.remaining_times || 0,
        basic60Count: basic60,
        basic90Count: basic90,
        advanced60Count: advanced60,
        advanced90Count: advanced90
      });
    }
    
    // 无论是否有缓存，都从数据库获取最新数据
    wx.showLoading({ title: '加载中...' });
    
    // 先尝试从缓存获取openid
    let openid = '';
    try {
      const wxContext = wx.getStorageSync('wxContext');
      if (wxContext && wxContext.OPENID) {
        openid = wxContext.OPENID;
        this.queryUserData(openid);
      } else {
        // 如果缓存没有，调用云函数获取
        this.getOpenIdAndQueryUser();
      }
    } catch (e) {
      console.error('获取openid失败:', e);
      this.getOpenIdAndQueryUser();
    }
  },

  // 获取OpenID并查询用户
  getOpenIdAndQueryUser() {
    console.log('开始获取OpenID并查询用户');
    wx.cloud.callFunction({
      name: 'getWXContext',
      success: res => {
        console.log('获取WXContext成功:', res.result);
        if (res.result && res.result.openid) {
          const openid = res.result.openid;
          // 保存openid到缓存
          wx.setStorageSync('wxContext', res.result);
          console.log('已保存openid到缓存:', openid);
          
          // 查询用户数据
          this.queryUserData(openid);
        } else {
          wx.hideLoading();
          console.error('获取用户openid失败，返回结果缺少openid字段');
          this.handleUserNotFound();
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用getWXContext云函数失败：', err);
        wx.showModal({
          title: '登录失败',
          content: '获取用户信息失败，请重新登录',
          showCancel: false,
          success: () => {
            wx.reLaunch({
              url: '/pages/login/login'
            });
          }
        });
      }
    });
  },
  
  // 使用openid查询用户数据
  queryUserData(openid) {
    console.log('开始查询用户数据，使用openid:', openid);
    if (!openid) {
      console.error('查询用户数据失败: openid为空');
      wx.hideLoading();
      this.handleUserNotFound();
      return;
    }

    const db = wx.cloud.database();
    db.collection('users')
      .where({
        _openid: openid
      })
      .get()
      .then(res => {
        wx.hideLoading();
        console.log('查询用户数据结果:', res);
        
        if (res.data && res.data.length > 0) {
          const userData = res.data[0];
          console.log('从数据库获取的用户数据:', userData);
          
          // 获取服务项目次数详情
          let basic60 = 0, basic90 = 0, advanced60 = 0, advanced90 = 0;
          
          if (userData.service_times) {
            // 使用新格式数据
            console.log('从数据库获取的service_times:', userData.service_times);
            basic60 = userData.service_times.basic_60 || 0;
            basic90 = userData.service_times.basic_90 || 0;
            advanced60 = userData.service_times.advanced_60 || 0;
            advanced90 = userData.service_times.advanced_90 || 0;
          } else {
            // 兼容旧格式数据
            console.log('数据库中没有service_times字段，使用旧格式数据');
            basic60 = userData.basic60Count || 0;
            basic90 = userData.basic90Count || 0;
            advanced60 = userData.advanced60Count || 0;
            advanced90 = userData.advanced90Count || 0;
          }
          
          // 确保userData中有service_times字段
          if (!userData.service_times) {
            console.log('初始化service_times字段');
            userData.service_times = {
              basic_60: basic60,
              basic_90: basic90,
              advanced_60: advanced60,
              advanced_90: advanced90
            };
            
            // 尝试更新数据库中的service_times字段
            db.collection('users').doc(userData._id).update({
              data: {
                service_times: userData.service_times
              }
            }).then(() => {
              console.log('service_times字段已更新到数据库');
            }).catch(err => {
              console.error('更新service_times字段失败:', err);
            });
          }
          
          // 确保remaining_times字段正确反映服务次数总和
          const totalTimes = basic60 + basic90 + advanced60 + advanced90;
          if (userData.remaining_times !== totalTimes) {
            console.log(`修正剩余次数: ${userData.remaining_times} -> ${totalTimes}`);
            userData.remaining_times = totalTimes;
            
            // 更新数据库中的总次数
            db.collection('users').doc(userData._id).update({
              data: {
                remaining_times: totalTimes
              }
            }).then(() => {
              console.log('remaining_times已更新到数据库');
            }).catch(err => {
              console.error('更新remaining_times失败:', err);
            });
          }
          
          // 更新页面显示
          this.setData({
            isLoggedIn: true,
            userInfo: userData,
            walletBalance: userData.wallet_balance || 0,
            remainingSessions: userData.remaining_times || 0,
            basic60Count: basic60,
            basic90Count: basic90,
            advanced60Count: advanced60,
            advanced90Count: advanced90
          });
          
          console.log('页面数据已从数据库更新:', {
            walletBalance: userData.wallet_balance || 0,
            remainingSessions: userData.remaining_times || 0,
            basic60Count: basic60,
            basic90Count: basic90,
            advanced60Count: advanced60,
            advanced90Count: advanced90
          });
          
          // 更新本地存储
          wx.setStorageSync('userInfo', userData);
          
          // 同时更新App全局变量中的用户信息
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.userInfo = userData;
            console.log('已更新全局用户信息');
          }
          
          // 保存登录状态
          wx.setStorageSync('isLoggedIn', true);
        } else {
          // 用户不存在，尝试检查手机号关联的账户
          console.log('通过openid未找到用户数据，尝试检查其他方式');
          this.checkUserByAlternativeMethods();
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('查询用户数据失败：', err);
        wx.showModal({
          title: '数据查询失败',
          content: '无法获取您的账户信息，请重新登录',
          showCancel: false,
          success: () => {
            this.handleUserNotFound();
          }
        });
      });
  },
  
  // 尝试通过其他方式查找用户
  checkUserByAlternativeMethods() {
    console.log('尝试通过其他方式查找用户');
    
    // 检查是否有本地缓存的手机号
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.phone) {
      console.log('从本地缓存发现手机号，尝试通过手机号查询:', userInfo.phone);
      
      const db = wx.cloud.database();
      db.collection('users')
        .where({
          phone: userInfo.phone
        })
        .get()
        .then(res => {
          if (res.data && res.data.length > 0) {
            console.log('通过手机号找到用户:', res.data[0]);
            // 更新openid
            const userData = res.data[0];
            
            // 如果当前用户没有openid，尝试更新
            if (!userData._openid) {
              try {
                const wxContext = wx.getStorageSync('wxContext');
                if (wxContext && wxContext.OPENID) {
                  console.log('尝试更新用户openid:', wxContext.OPENID);
                  db.collection('users').doc(userData._id).update({
                    data: {
                      _openid: wxContext.OPENID
                    }
                  }).then(() => {
                    console.log('成功更新用户openid');
                  }).catch(err => {
                    console.error('更新用户openid失败:', err);
                  });
                }
              } catch (e) {
                console.error('尝试更新openid时出错:', e);
              }
            }
            
            // 使用找到的用户数据更新页面
            this.setData({
              isLoggedIn: true,
              userInfo: userData,
              walletBalance: userData.wallet_balance || 0,
              remainingSessions: userData.remaining_times || 0
            });
            
            // 更新本地存储
            wx.setStorageSync('userInfo', userData);
            wx.setStorageSync('isLoggedIn', true);
            
            // 添加标记，防止循环加载
            wx.setStorageSync('dataRestored', true);
            
            // 提示用户刷新页面以获取完整数据
            wx.showToast({
              title: '数据已恢复',
              icon: 'success'
            });
            
            // 延迟刷新页面，但不再通过loadUserInfo进行递归调用
            setTimeout(() => {
              // 手动更新服务次数数据
              let basic60 = 0, basic90 = 0, advanced60 = 0, advanced90 = 0;
              
              if (userData.service_times) {
                basic60 = userData.service_times.basic_60 || 0;
                basic90 = userData.service_times.basic_90 || 0;
                advanced60 = userData.service_times.advanced_60 || 0;
                advanced90 = userData.service_times.advanced_90 || 0;
              }
              
              this.setData({
                basic60Count: basic60,
                basic90Count: basic90,
                advanced60Count: advanced60,
                advanced90Count: advanced90
              });
            }, 1500);
            
            return;
          }
          
          // 如果通过手机号也找不到，则按用户未找到处理
          console.log('通过手机号也未找到用户');
          this.handleUserNotFound();
        })
        .catch(err => {
          console.error('通过手机号查询用户失败:', err);
          this.handleUserNotFound();
        });
    } else {
      // 没有可用的替代方法，直接处理用户未找到
      console.log('没有可用的替代方法找到用户');
      this.handleUserNotFound();
    }
  },
  
  // 处理用户未找到的情况
  handleUserNotFound() {
    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    console.log('处理用户未找到情况，当前登录状态:', isLoggedIn);
    
    if (!isLoggedIn) {
      // 未登录，跳转到登录页
      console.log('用户未登录，跳转到登录页');
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      });
    } else {
      // 已登录但未找到用户，可能是首次使用或数据丢失
      console.log('用户已登录但未找到数据，提示重新登录');
      wx.showModal({
        title: '提示',
        content: '未找到您的用户数据，请重新登录',
        showCancel: false,
        success: () => {
          // 清除登录状态
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('userType');
          wx.removeStorageSync('wxContext');
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      });
    }
  },

  // 更新用户信息前检查权限
  updateUserInfo() {
    // 检查操作权限
    const app = getApp();
    if (!app.checkActionPermission('update_profile')) {
      wx.showToast({
        title: '您没有更新信息的权限',
        icon: 'none'
      });
      return;
    }
    
    // 执行更新逻辑...
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态和权限
          wx.removeStorageSync('isLoggedIn');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('userType');
          wx.removeStorageSync('walletBalance');
          wx.removeStorageSync('remainingSessions');
          
          // 返回登录页面
          wx.redirectTo({
            url: '/pages/login/login'
          });
        }
      }
    });
  },

  // 修改跳转方法：不检查登录状态，直接跳转
  goToRecharge() {
    wx.navigateTo({
      url: '/pages/recharge/recharge',
      fail: (err) => {
        console.error('跳转到充值页面失败:', err);
        // 如果失败，尝试其他跳转方式
        wx.switchTab({
          url: '/pages/recharge/recharge',
          fail: (err2) => {
            console.error('switchTab也失败:', err2);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
      }
    });
  },

  goToHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  goToOrders() {
    wx.navigateTo({
      url: '/pages/orders/orders',
      fail: (err) => {
        console.error('navigateTo失败:', err);
        // 如果navigateTo失败，尝试reLaunch
        wx.reLaunch({
          url: '/pages/orders/orders',
          fail: (err2) => {
            console.error('reLaunch也失败:', err2);
            wx.showToast({
              title: '页面加载失败',
              icon: 'none'
            });
          }
        });
      }
    });
  },

  goToVerification() {
    wx.navigateTo({
      url: '/pages/verification/verification'
    });
  },

  // 显示剩余次数详情
  showRemainingDetails() {
    // 获取用户信息和类型
    const userInfo = wx.getStorageSync('userInfo');
    const userType = wx.getStorageSync('userType');
    
    // 检查是否已有详细次数数据
    let hasDetailData = false;
    
    if (userInfo) {
      if (userInfo.service_times) {
        // 新格式数据
        hasDetailData = true;
        this.setData({
          basic60Count: userInfo.service_times.basic_60 || 0,
          basic90Count: userInfo.service_times.basic_90 || 0,
          advanced60Count: userInfo.service_times.advanced_60 || 0,
          advanced90Count: userInfo.service_times.advanced_90 || 0,
          showRemainingModal: true
        });
      } else if (userInfo.basic60Count !== undefined) {
        // 旧格式数据
        hasDetailData = true;
        this.setData({
          basic60Count: userInfo.basic60Count || 0,
          basic90Count: userInfo.basic90Count || 0,
          advanced60Count: userInfo.advanced60Count || 0,
          advanced90Count: userInfo.advanced90Count || 0,
          showRemainingModal: true
        });
      }
    }
    
    // 如果本地没有缓存次数信息，则从数据库获取
    if (!hasDetailData) {
      this.fetchRemainingCounts();
    }
  },

  // 隐藏剩余次数详情
  hideRemainingDetails() {
    this.setData({
      showRemainingModal: false
    });
  },

  // 获取各项目剩余次数 - 直接查询云数据库
  fetchRemainingCounts() {
    // 显示加载中
    wx.showLoading({
      title: '加载中...'
    });
    
    // 检查是否是管理员账号
    const userType = wx.getStorageSync('userType');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (userType === 'admin' && userInfo && userInfo.phone) {
      // 管理员账号直接使用手机号查询
      const db = wx.cloud.database();
      db.collection('users')
        .where({
          phone: userInfo.phone,
          userType: 'admin'
        })
        .get()
        .then(result => {
          this.processUserData(result);
        })
        .catch(err => {
          console.error('查询管理员数据失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '获取次数信息失败',
            icon: 'none'
          });
        });
    } else {
      // 普通用户使用openid查询
      wx.cloud.callFunction({
        name: 'getWXContext',
        success: res => {
          if (res.result && res.result.openid) {
            const openid = res.result.openid;
            
            // 获取到openid后直接查询数据库
            const db = wx.cloud.database();
            db.collection('users')
              .where({
                _openid: openid
              })
              .get()
              .then(result => {
                this.processUserData(result);
              })
              .catch(err => {
                console.error('查询用户数据失败:', err);
                wx.hideLoading();
                wx.showToast({
                  title: '获取次数信息失败',
                  icon: 'none'
                });
              });
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '获取用户信息失败',
              icon: 'none'
            });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('获取用户openid失败:', err);
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          });
        }
      });
    }
  },
  
  // 处理用户数据
  processUserData(result) {
    wx.hideLoading();
    
    if (result.data && result.data.length > 0) {
      const userData = result.data[0];
      console.log('processUserData处理的用户数据:', userData);
      
      // 获取各服务次数
      let basic60 = 0, basic90 = 0, advanced60 = 0, advanced90 = 0;
      
      if (userData.service_times) {
        // 优先使用新格式数据
        console.log('processUserData使用service_times格式数据:', userData.service_times);
        basic60 = userData.service_times.basic_60 || 0;
        basic90 = userData.service_times.basic_90 || 0;
        advanced60 = userData.service_times.advanced_60 || 0;
        advanced90 = userData.service_times.advanced_90 || 0;
      } else {
        // 兼容旧格式数据
        console.log('processUserData使用旧格式数据');
        basic60 = userData.basic60Count || 0;
        basic90 = userData.basic90Count || 0;
        advanced60 = userData.advanced60Count || 0;
        advanced90 = userData.advanced90Count || 0;
      }
      
      // 确保数据正确
      const totalTimes = basic60 + basic90 + advanced60 + advanced90;
      if (userData.remaining_times !== totalTimes) {
        console.log(`processUserData修正剩余次数: ${userData.remaining_times} -> ${totalTimes}`);
        userData.remaining_times = totalTimes;
      }
      
      // 更新页面显示
      this.setData({
        basic60Count: basic60,
        basic90Count: basic90,
        advanced60Count: advanced60,
        advanced90Count: advanced90,
        showRemainingModal: true
      });
      
      console.log('processUserData更新的数据:', {
        basic60Count: basic60,
        basic90Count: basic90,
        advanced60Count: advanced60,
        advanced90Count: advanced90
      });
      
      // 更新本地存储
      // 更新本地存储中的次数
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        // 确保service_times字段存在且正确
        userInfo.service_times = {
          basic_60: basic60,
          basic_90: basic90,
          advanced_60: advanced60,
          advanced_90: advanced90
        };
        
        // 更新各项数据字段，确保一致性
        userInfo.basic60Count = basic60;
        userInfo.basic90Count = basic90;
        userInfo.advanced60Count = advanced60;
        userInfo.advanced90Count = advanced90;
        userInfo.remaining_times = totalTimes; // 确保总次数一致
        
        // 保存到本地
        wx.setStorageSync('userInfo', userInfo);
        console.log('本地存储的用户信息已更新:', userInfo);
      }
    } else {
      wx.showToast({
        title: '未找到用户数据',
        icon: 'none'
      });
    }
  },

  // 检查并自动更新已支付订单状态为已完成
  checkAndUpdatePaidOrders() {
    console.log('检查并更新已支付订单状态');
    const now = new Date();
    
    // 调用云函数查询所有已支付的订单
    wx.cloud.callFunction({
      name: 'getOrdersByStatus',
      data: {
        status: 'paid',
        includeExpired: true
      }
    })
    .then(res => {
      if (res.result && res.result.success && res.result.orders) {
        const paidOrders = res.result.orders;
        console.log(`找到 ${paidOrders.length} 个已支付订单`);
        
        // 找出应该更新为已完成的订单
        const ordersToUpdate = paidOrders.filter(order => {
          try {
            const appointmentDate = order.appointment_date;
            const timeSlot = order.time_slot;
            
            if (appointmentDate && timeSlot) {
              // 解析预约日期和时间
              const [year, month, day] = appointmentDate.split('-').map(Number);
              const [hours, minutes] = timeSlot.split(':').map(Number);
              
              // 创建预约时间对象
              const appointmentDateTime = new Date(year, month - 1, day, hours, minutes);
              
              // 获取服务时长（默认60分钟）
              const serviceDuration = order.service_duration || 60;
              
              // 计算服务结束时间
              const serviceEndTime = new Date(appointmentDateTime.getTime() + serviceDuration * 60 * 1000);
              
              // 如果当前时间超过了服务结束时间，标记为需要更新
              return now > serviceEndTime;
            }
            return false;
          } catch (err) {
            console.error(`处理订单 ${order._id} 时出错:`, err);
            return false;
          }
        });
        
        console.log(`找到 ${ordersToUpdate.length} 个需要更新为已完成的订单`);
        
        // 批量更新订单状态
        if (ordersToUpdate.length > 0) {
          this.batchUpdateOrdersToCompleted(ordersToUpdate);
        }
      }
    })
    .catch(err => {
      console.error('查询已支付订单失败:', err);
    });
  },
  
  // 批量更新订单为已完成
  batchUpdateOrdersToCompleted(orders) {
    // 每次最多处理5个订单
    const batchSize = 5;
    const batches = [];
    
    // 将订单分批
    for (let i = 0; i < orders.length; i += batchSize) {
      batches.push(orders.slice(i, i + batchSize));
    }
    
    // 逐批处理
    batches.forEach((batch, index) => {
      // 延迟执行，避免同时发起太多请求
      setTimeout(() => {
        console.log(`处理第 ${index+1}/${batches.length} 批订单状态更新为已完成`);
        
        // 提取订单ID
        const orderIds = batch.map(order => ({
          id: order._id,
          collection: order._collection || 'orders' // 使用订单所在的集合名称
        }));
        
        wx.cloud.callFunction({
          name: 'batchUpdateOrders',
          data: {
            orders: orderIds,
            updateData: {
              status: 'completed',
              auto_completed: true,
              complete_time: new Date()
            }
          },
          success: res => {
            console.log(`第 ${index+1} 批订单状态更新结果:`, res.result);
          },
          fail: err => {
            console.error(`批量更新订单状态失败:`, err);
          }
        });
      }, index * 1000);
    });
  },

  onUnload() {
    // 页面卸载时移除事件监听
    const app = getApp();
    if (this.memberInfoUpdateListener && app && typeof app.getEventBus === 'function') {
      const eventBus = app.getEventBus();
      eventBus.off('memberInfoUpdated', this.memberInfoUpdateListener);
    }
  },
}); 