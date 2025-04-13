Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    selectedDate: '',
    selectedTime: '',
    services: [],
    basicServices: [], // 基础拉伸服务
    advancedServices: [], // 肌肉筋膜处理服务
    selectedService: null,
    showPaymentOptions: false, // 控制支付选项弹窗
    walletBalance: 0,           // 钱包余额
    remainingSessions: 0,       // 总剩余次数
    basic60Count: 0,           // 基础服务60分钟次数
    basic90Count: 0,           // 基础服务90分钟次数
    advanced60Count: 0,        // 高级服务60分钟次数
    advanced90Count: 0,        // 高级服务90分钟次数
    showSessionsDetail: false,  // 控制次数详情弹窗显示
    therapists: [],            // 所有理疗师列表
    selectedTherapistId: '',   // 当前选择的理疗师ID
  },

  onLoad(options) {
    const { date, time, therapistId } = options;
    this.setData({
      selectedDate: date || '',
      selectedTime: time || '',
      selectedTherapistId: therapistId || ''
    });

    // 检查登录状态
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    if (!isLoggedIn) {
      wx.redirectTo({
        url: '/pages/login/account/account'
      });
      return;
    }

    this.loadUserInfo();
    this.loadServices();
    
    // 如果没有传入理疗师ID，则自动加载一个可用的理疗师
    if (!therapistId) {
      this.loadTherapists();
    }
  },

  onShow() {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    if (!isLoggedIn) {
      wx.redirectTo({
        url: '/pages/login/account/account'
      });
      return;
    }
  },
  
  // 加载理疗师列表
  loadTherapists() {
    wx.showLoading({ title: '加载中...' });
    
    const db = wx.cloud.database();
    db.collection('therapists')
      .where({ status: 'active' })
      .get()
      .then(res => {
        console.log('获取理疗师列表:', res.data);
        
        if (res.data && res.data.length > 0) {
          this.setData({
            therapists: res.data
          });
          
          // 检查当前日期时间是否已有可用的理疗师
          this.checkTherapistAvailability(res.data);
        } else {
          console.warn('未找到可用的理疗师');
        }
        
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取理疗师列表失败:', err);
        wx.hideLoading();
      });
  },
  
  // 检查理疗师在当前时间段的可用性
  checkTherapistAvailability(therapists) {
    if (!this.data.selectedDate || !this.data.selectedTime) {
      console.log('未选择日期或时间，无法检查理疗师可用性');
      return;
    }
    
    const db = wx.cloud.database();
    const _ = db.command;
    
    console.log('检查日期时间的理疗师可用性:', this.data.selectedDate, this.data.selectedTime);
    
    // 查询当前时间段已有的预约 - 使用更灵活的查询条件
    db.collection('appointments')
      .where(_.or([
        {
          appointment_date: this.data.selectedDate,
          time_slot: this.data.selectedTime,
          status: _.in(['pending', 'paid', 'confirmed'])
        },
        {
          date: this.data.selectedDate,
          time: this.data.selectedTime,
          status: _.in(['pending', 'paid', 'confirmed'])
        }
      ]))
      .get()
      .then(res => {
        console.log('当前时间段的预约:', res.data);
        
        // 获取已被预约的理疗师ID
        const bookedTherapistIds = res.data.map(item => {
          // 考虑多种可能的理疗师ID字段
          return item.therapist_id || item.staff_id || item.therapistId;
        }).filter(id => id); // 过滤掉空值
        
        console.log('已被预约的理疗师ID:', bookedTherapistIds);
        
        // 筛选出可用的理疗师
        const availableTherapists = therapists.filter(therapist => 
          !bookedTherapistIds.includes(therapist._id)
        );
        
        console.log('可用的理疗师:', availableTherapists.map(t => ({ id: t._id, name: t.name })));
        
        if (availableTherapists.length > 0) {
          // 自动选择第一个可用的理疗师
          this.setData({
            selectedTherapistId: availableTherapists[0]._id
          });
          
          console.log('已自动选择理疗师:', availableTherapists[0].name, availableTherapists[0]._id);
        } else if (therapists.length > 0) {
          // 如果没有可用的理疗师，但有理疗师列表，则选择第一个理疗师
          this.setData({
            selectedTherapistId: therapists[0]._id
          });
          
          console.log('所有理疗师当前时段均已被预约，默认选择第一个理疗师:', therapists[0].name);
          
          // 提示用户所选时段已满
          wx.showToast({
            title: '当前时段理疗师已满，可能需要等待',
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(err => {
        console.error('检查理疗师可用性失败:', err);
        
        // 出错时默认选择第一个理疗师
        if (!this.data.selectedTherapistId && therapists.length > 0) {
          this.setData({
            selectedTherapistId: therapists[0]._id
          });
          console.log('查询出错，默认选择第一个理疗师:', therapists[0].name, therapists[0]._id);
        }
      });
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      // 基本信息设置
      this.setData({
        userInfo,
        isLoggedIn: true,
        walletBalance: userInfo.wallet_balance || 0
      });
      
      // 处理剩余次数信息 - 支持新旧两种格式
      if (userInfo.service_times) {
        // 新格式 - service_times对象
        this.setData({
          remainingSessions: this.calculateTotalSessions(userInfo.service_times),
          basic60Count: userInfo.service_times.basic_60 || 0,
          basic90Count: userInfo.service_times.basic_90 || 0,
          advanced60Count: userInfo.service_times.advanced_60 || 0,
          advanced90Count: userInfo.service_times.advanced_90 || 0
        });
      } else {
        // 旧格式 - 直接包含各种次数字段
        this.setData({
          remainingSessions: userInfo.remaining_times || 0,
          basic60Count: userInfo.basic60Count || 0,
          basic90Count: userInfo.basic90Count || 0,
          advanced60Count: userInfo.advanced60Count || 0,
          advanced90Count: userInfo.advanced90Count || 0
        });
      }
      
      // 从数据库获取最新的用户信息
      this.fetchLatestUserInfo(userInfo._id);
    }
  },
  
  // 计算总剩余次数
  calculateTotalSessions(serviceTimes) {
    if (!serviceTimes) return 0;
    
    return (serviceTimes.basic_60 || 0) +
           (serviceTimes.basic_90 || 0) +
           (serviceTimes.advanced_60 || 0) +
           (serviceTimes.advanced_90 || 0);
  },
  
  // 从数据库获取最新的用户信息
  fetchLatestUserInfo(userId) {
    if (!userId) return;
    
    const db = wx.cloud.database();
    db.collection('users')
      .doc(userId)
      .get()
      .then(res => {
        if (res.data) {
          const latestUserInfo = res.data;
          
          // 更新本地存储
          wx.setStorageSync('userInfo', latestUserInfo);
          
          // 更新页面数据
          if (latestUserInfo.service_times) {
            // 新格式
            this.setData({
              walletBalance: latestUserInfo.wallet_balance || 0,
              remainingSessions: this.calculateTotalSessions(latestUserInfo.service_times),
              basic60Count: latestUserInfo.service_times.basic_60 || 0,
              basic90Count: latestUserInfo.service_times.basic_90 || 0,
              advanced60Count: latestUserInfo.service_times.advanced_60 || 0,
              advanced90Count: latestUserInfo.service_times.advanced_90 || 0
            });
          } else {
            // 旧格式
            this.setData({
              walletBalance: latestUserInfo.wallet_balance || 0,
              remainingSessions: latestUserInfo.remaining_times || 0,
              basic60Count: latestUserInfo.basic60Count || 0,
              basic90Count: latestUserInfo.basic90Count || 0,
              advanced60Count: latestUserInfo.advanced60Count || 0,
              advanced90Count: latestUserInfo.advanced90Count || 0
            });
          }
          
          console.log('获取到最新用户信息:', latestUserInfo);
        }
      })
      .catch(err => {
        console.error('获取最新用户信息失败:', err);
      });
  },

  loadServices() {
    const db = wx.cloud.database();
    
    console.log('开始加载服务列表...');
    db.collection('services')
      .where({
        status: 'active'
      })
      .orderBy('sort', 'asc')
      .get()
      .then(res => {
        console.log('加载到的服务数据：', res.data);
        if (res.data.length === 0) {
          console.warn('服务数据为空，可能需要检查数据库或点击初始化按钮');
          wx.showToast({
            title: '服务数据为空',
            icon: 'none'
          });
          return;
        }
        
        const basicServices = res.data.filter(s => s.category === 'basic');
        const advancedServices = res.data.filter(s => s.category === 'advanced');
        
        console.log('基础服务：', basicServices);
        console.log('高级服务：', advancedServices);
        
        this.setData({
          services: res.data,
          basicServices,
          advancedServices
        });
      })
      .catch(err => {
        console.error('加载服务列表失败：', err);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
  },

  // 仅选择服务，不立即预约
  onServiceSelect(e) {
    const { id } = e.currentTarget.dataset;
    const selectedService = this.data.services.find(s => s._id === id);
    this.setData({ selectedService });
  },

  // 点击立即预约按钮
  confirmBooking() {
    if (!this.data.selectedService) {
      wx.showToast({
        title: '请选择服务',
        icon: 'none'
      });
      return;
    }

    // 显示支付选项弹窗
    this.setData({
      showPaymentOptions: true
    });
  },

  // 选择支付方式
  selectPayment(e) {
    const { method } = e.currentTarget.dataset;
    
    // 检查支付方式是否可用
    if (method === 'wallet' && this.data.walletBalance < this.data.selectedService.price) {
      wx.showToast({
        title: '钱包余额不足',
        icon: 'none'
      });
      return;
    }

    if (method === 'times') {
      // 获取当前服务对应的次数字段
      const serviceType = this.data.selectedService.category;
      const serviceDuration = this.data.selectedService.duration;
      
      // 直接使用相应的计数器
      let availableCount = 0;
      let serviceCountField = '';
      
      if (serviceType === 'basic' && serviceDuration === 60) {
        availableCount = this.data.basic60Count;
        serviceCountField = 'basic60Count';
      } else if (serviceType === 'basic' && serviceDuration === 90) {
        availableCount = this.data.basic90Count;
        serviceCountField = 'basic90Count';
      } else if (serviceType === 'advanced' && serviceDuration === 60) {
        availableCount = this.data.advanced60Count;
        serviceCountField = 'advanced60Count';
      } else if (serviceType === 'advanced' && serviceDuration === 90) {
        availableCount = this.data.advanced90Count;
        serviceCountField = 'advanced90Count';
      }
      
      console.log(`检查次数抵扣 - 类型: ${serviceType}, 时长: ${serviceDuration}, 可用次数: ${availableCount}`);

      if (availableCount <= 0) {
        wx.showToast({
          title: '该服务剩余次数不足',
          icon: 'none'
        });
        return;
      }
    }

    // 关闭支付选项弹窗
    this.setData({
      showPaymentOptions: false
    });

    // 确认预约信息
    wx.showModal({
      title: '确认预约',
      content: `${this.data.selectedDate} ${this.data.selectedTime}\n${this.data.selectedService.name}\n¥${this.data.selectedService.price}\n支付方式: ${this.getPaymentName(method)}`,
      success: (res) => {
        if (res.confirm) {
          this.createAppointment(method);
        }
      }
    });
  },

  // 获取支付方式名称
  getPaymentName(method) {
    switch(method) {
      case 'wechat': return '微信支付';
      case 'wallet': return '钱包余额';
      case 'times': return '次数抵扣';
      default: return '未知方式';
    }
  },

  // 关闭支付选项弹窗
  closePaymentOptions() {
    this.setData({
      showPaymentOptions: false
    });
  },

  // 创建预约
  createAppointment(paymentMethod) {
    const db = wx.cloud.database();
    
    // 再次检查支付方式是否可用
    if (paymentMethod === 'wallet' && this.data.walletBalance < this.data.selectedService.price) {
      wx.showToast({
        title: '钱包余额不足',
        icon: 'none'
      });
      return;
    }

    if (paymentMethod === 'times') {
      // 获取当前服务对应的次数字段
      const serviceType = this.data.selectedService.category;
      const serviceDuration = this.data.selectedService.duration;
      
      // 直接使用相应的计数器
      let availableCount = 0;
      let serviceCountField = '';
      
      if (serviceType === 'basic' && serviceDuration === 60) {
        availableCount = this.data.basic60Count;
        serviceCountField = 'basic60Count';
      } else if (serviceType === 'basic' && serviceDuration === 90) {
        availableCount = this.data.basic90Count;
        serviceCountField = 'basic90Count';
      } else if (serviceType === 'advanced' && serviceDuration === 60) {
        availableCount = this.data.advanced60Count;
        serviceCountField = 'advanced60Count';
      } else if (serviceType === 'advanced' && serviceDuration === 90) {
        availableCount = this.data.advanced90Count;
        serviceCountField = 'advanced90Count';
      }
      
      console.log(`创建预约 - 类型: ${serviceType}, 时长: ${serviceDuration}, 可用次数: ${availableCount}`);

      if (availableCount <= 0) {
        wx.showToast({
          title: '该服务剩余次数不足',
          icon: 'none'
        });
        return;
      }
    }
    
    // 检查是否已选择理疗师
    if (!this.data.selectedTherapistId) {
      console.error('未选择理疗师，尝试自动分配');
      // 如果没有选择理疗师，重新获取理疗师列表并分配
      this.loadTherapists();
      
      if (!this.data.selectedTherapistId) {
        wx.showToast({
          title: '无法分配理疗师，请稍后再试',
          icon: 'none'
        });
        return;
      }
    }
    
    // 准备预约数据
    const appointment = {
      _openid: this.data.userInfo._openid,
      user_id: this.data.userInfo._id,
      user_name: this.data.userInfo.name || this.data.userInfo.nickName,
      user_phone: this.data.userInfo.phone || '',
      service_id: this.data.selectedService._id,
      service_name: this.data.selectedService.name,
      service_duration: this.data.selectedService.duration,
      service_category: this.data.selectedService.category,
      price: this.data.selectedService.price,
      appointment_date: this.data.selectedDate,
      time_slot: this.data.selectedTime,
      payment_method: paymentMethod,
      status: 'pending',
      create_time: db.serverDate(),
      therapist_id: this.data.selectedTherapistId,
      staff_id: this.data.selectedTherapistId  // 确保therapist_id和staff_id同步
    };

    console.log('创建预约数据:', appointment);

    // 如果是微信支付，调用支付云函数
    if (paymentMethod === 'wechat') {
      wx.showLoading({ title: '发起支付...' });
      
      // 调用pay云函数处理支付
      wx.cloud.callFunction({
        name: 'pay',
        data: {
          amount: appointment.price,
          type: 'appointment',
          appointmentInfo: {
            service_id: appointment.service_id,
            service_name: appointment.service_name,
            appointment_date: appointment.appointment_date,
            time_slot: appointment.time_slot,
            service_duration: appointment.service_duration
          }
        }
      })
      .then(res => {
        wx.hideLoading();
        if (res.result && res.result.success && res.result.payment) {
          // 保存订单ID用于后续处理
          appointment.order_id = res.result.order_id;
          
          // 调用微信支付
          wx.requestPayment({
            ...res.result.payment,
            success: () => {
              // 支付成功，创建预约记录
              appointment.status = 'paid'; // 更新状态为已支付
              this.processAppointmentWithCloudFunction(appointment);
            },
            fail: err => {
              console.error('支付失败:', err);
              wx.showToast({
                title: '支付已取消',
                icon: 'none'
              });
            }
          });
        } else {
          console.error('发起支付失败:', res.result);
          wx.showToast({
            title: '支付失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('调用支付云函数失败:', err);
        wx.showToast({
          title: '支付失败',
          icon: 'none'
        });
      });
      return;
    }

    // 钱包支付或次数支付，直接处理
    wx.showLoading({ title: '处理中...' });
    this.processAppointmentWithCloudFunction(appointment);
  },
  
  // 使用云函数处理预约创建
  processAppointmentWithCloudFunction(appointment) {
    console.log('处理预约，理疗师ID:', appointment.therapist_id, '员工ID:', appointment.staff_id);
    
    wx.cloud.callFunction({
      name: 'createAppointment',
      data: {
        appointment: appointment,
        userInfo: this.data.userInfo
      }
    })
    .then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        console.log('预约创建成功:', res.result);
        
        // 更新本地用户信息
        if (res.result.updatedUser) {
          const updatedUser = res.result.updatedUser;
          wx.setStorageSync('userInfo', updatedUser);
          
          // 更新页面显示的用户信息
          this.setData({
            userInfo: updatedUser
          });
          
          // 更新页面显示的余额和次数
          if (updatedUser.service_times) {
            // 新格式
            this.setData({
              walletBalance: updatedUser.wallet_balance || 0,
              remainingSessions: this.calculateTotalSessions(updatedUser.service_times),
              basic60Count: updatedUser.service_times.basic_60 || 0,
              basic90Count: updatedUser.service_times.basic_90 || 0,
              advanced60Count: updatedUser.service_times.advanced_60 || 0,
              advanced90Count: updatedUser.service_times.advanced_90 || 0
            });
          } else {
            // 旧格式
            this.setData({
              walletBalance: updatedUser.wallet_balance || 0,
              remainingSessions: updatedUser.remaining_times || 0,
              basic60Count: updatedUser.basic60Count || 0,
              basic90Count: updatedUser.basic90Count || 0,
              advanced60Count: updatedUser.advanced60Count || 0,
              advanced90Count: updatedUser.advanced90Count || 0
            });
          }
        }
        
        let paymentText = '';
        if (appointment.payment_method === 'wallet') {
          paymentText = '已使用钱包余额支付';
        } else if (appointment.payment_method === 'times') {
          paymentText = '已使用次数抵扣';
        } else {
          paymentText = '预约成功';
        }
        
        wx.showToast({
          title: paymentText,
          icon: 'success'
        });
        
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/orders/orders?from=booking'
          });
        }, 1500);
      } else {
        console.error('预约创建失败:', res.result ? res.result.errMsg : '未知错误');
        wx.showToast({
          title: res.result ? res.result.errMsg : '预约失败',
          icon: 'none'
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error('调用云函数失败:', err);
      wx.showToast({
        title: '预约失败',
        icon: 'none'
      });
    });
  },

  // 添加获取服务类型对应次数字段的方法
  getServiceCountField(type, duration) {
    const durationStr = duration === 90 ? '90' : '60';
    if (type === 'basic') {
      return `basic${durationStr}Count`;
    } else if (type === 'advanced') {
      return `advanced${durationStr}Count`;
    }
    return 'remainingSessions'; // 默认返回总次数
  },

  // 初始化服务数据
  initServicesData() {
    wx.showLoading({
      title: '初始化服务数据...',
    });

    wx.cloud.callFunction({
      name: 'addServices'
    })
    .then(res => {
      console.log('云函数返回原始结果:', res);
      
      if (res.result && res.result.success) {
        console.log('添加成功详情:', res.result);
        const addedCount = res.result.addedCount || 0;
        wx.showToast({
          title: `成功添加${addedCount}项服务`,
          icon: 'success'
        });
        
        // 重新加载服务数据
        setTimeout(() => {
          this.loadServices();
        }, 1000);
      } else {
        const errorMsg = res.result ? (res.result.message || res.result.error || '未知错误') : '返回结果为空';
        console.error('添加失败详情:', res.result);
        console.error('错误信息:', errorMsg);
        
        wx.showToast({
          title: `添加失败: ${errorMsg}`,
          icon: 'none',
          duration: 3000
        });
      }
    })
    .catch(err => {
      console.error('调用云函数失败详情:', err);
      wx.showToast({
        title: `调用失败: ${err.message || '未知错误'}`,
        icon: 'none',
        duration: 3000
      });
    })
    .finally(() => {
      wx.hideLoading();
    });
  },

  // 添加显示次数详情的方法
  showSessionsDetailModal(e) {
    this.setData({
      showSessionsDetail: true
    });
  },

  // 关闭次数详情弹窗
  closeSessionsDetail() {
    this.setData({
      showSessionsDetail: false
    });
  },
}); 
