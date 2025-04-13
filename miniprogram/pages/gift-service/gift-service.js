Page({
  data: {
    step: 1, // 1: 输入手机号, 2: 选择赠送项目
    phoneNumber: '',
    userInfo: null,
    giftTimes: 1,
    loading: false,
    reason: '',
    serviceType: '', // 'basic' 或 'advanced'
    duration: null, // 60 或 90 分钟
    giftRecords: [] // 最近赠送记录
  },

  onLoad() {
    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    // 先加载员工信息，然后再加载赠送记录
    this.loadStaffInfo();
  },

  // 加载赠送记录
  loadGiftRecords() {
    const db = wx.cloud.database();
    const staffInfo = this.data.staffInfo;
    
    if (!staffInfo || !staffInfo._id) {
      return; // 员工信息不完整时直接返回，不显示提示（因为loadStaffInfo中已经处理）
    }
    
    db.collection('gift_records')
      .where({
        staff_id: staffInfo._id
      })
      .orderBy('gift_time', 'desc')
      .limit(5)
      .get()
      .then(res => {
        this.setData({
          giftRecords: res.data
        });
      })
      .catch(err => {
        console.error('获取赠送记录失败:', err);
      });
  },

  // 输入手机号
  inputPhoneNumber(e) {
    this.setData({
      phoneNumber: e.detail.value
    });
  },

  // 查询会员
  searchMember() {
    if (this.data.phoneNumber.length !== 11) {
      wx.showToast({
        title: '请输入有效的手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });
    console.log('开始查询会员，手机号:', this.data.phoneNumber);

    const db = wx.cloud.database();
    
    // 先尝试不带is_staff条件查询
    db.collection('users').where({
      phone: this.data.phoneNumber
    }).get().then(res => {
      console.log('查询结果:', res.data);
      
      if (res.data.length === 0) {
        wx.showModal({
          title: '未找到会员',
          content: '系统中不存在此手机号，是否创建新会员？',
          success: (result) => {
            if (result.confirm) {
              this.createNewMember();
            }
          }
        });
        this.setData({ loading: false });
        return;
      }

      // 找到用户，检查是否是员工
      const user = res.data[0];
      if (user.is_staff === true) {
        wx.showToast({
          title: '该用户是员工账号，不能赠送',
          icon: 'none'
        });
        this.setData({ loading: false });
        return;
      }

      // 确保service_times字段初始化
      if (!user.service_times) {
        user.service_times = {
          basic_60: 0,
          basic_90: 0,
          advanced_60: 0,
          advanced_90: 0
        };
        
        // 使用云函数更新用户数据，而不是直接从客户端更新
        wx.cloud.callFunction({
          name: 'initServiceTimes',
          data: {
            userId: user._id
          }
        }).then(() => {
          console.log('用户service_times字段初始化成功');
        }).catch(err => {
          console.error('初始化service_times失败:', err);
        });
      }

      this.setData({
        userInfo: user,
        step: 2,
        loading: false
      });
    }).catch(err => {
      console.error('查询会员失败，详细错误:', err);
      wx.showModal({
        title: '查询失败',
        content: '详细错误: ' + JSON.stringify(err),
        showCancel: false
      });
      this.setData({ loading: false });
    });
  },

  // 创建新会员
  createNewMember() {
    const db = wx.cloud.database();
    const newUser = {
      phone: this.data.phoneNumber,
      nickName: '新会员-' + this.data.phoneNumber.substr(-4),
      is_staff: false,
      remaining_times: 0,
      create_time: db.serverDate(),
      // 添加服务次数字段初始化
      service_times: {
        basic_60: 0,
        basic_90: 0,
        advanced_60: 0,
        advanced_90: 0
      }
    };

    wx.showLoading({
      title: '创建会员中...',
    });

    db.collection('users').add({
      data: newUser
    }).then(res => {
      wx.hideLoading();
      console.log('创建会员成功:', res);
      
      // 添加ID并设置为当前用户
      newUser._id = res._id;
      this.setData({
        userInfo: newUser,
        step: 2,
        loading: false
      });
      
      wx.showToast({
        title: '已创建新会员',
        icon: 'success'
      });
    }).catch(err => {
      wx.hideLoading();
      console.error('创建会员失败:', err);
      wx.showModal({
        title: '创建会员失败',
        content: JSON.stringify(err),
        showCancel: false
      });
      this.setData({ loading: false });
    });
  },

  // 返回手机号输入
  backToPhoneInput() {
    this.setData({
      step: 1,
      serviceType: '',
      duration: null
    });
  },

  // 选择服务类型
  selectServiceType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      serviceType: type
    });
    
    // 添加振动反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    // 如果两项都已选择，显示提示
    if (this.data.duration) {
      this.checkSelectionComplete();
    }
  },

  // 选择服务时长
  selectDuration(e) {
    const duration = parseInt(e.currentTarget.dataset.duration);
    this.setData({
      duration: duration
    });
    
    // 添加振动反馈
    wx.vibrateShort({
      type: 'medium'
    });
    
    // 如果两项都已选择，显示提示
    if (this.data.serviceType) {
      this.checkSelectionComplete();
    }
  },
  
  // 检查是否完成选择并提示用户
  checkSelectionComplete() {
    if (this.data.serviceType && this.data.duration) {
      const serviceTypeName = this.data.serviceType === 'basic' ? '基础拉伸' : '肌肉筋膜处理/运动训练';
      const price = this.getServicePrice();
      
      wx.showToast({
        title: `已选择: ${serviceTypeName} ${this.data.duration}分钟 ¥${price}`,
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 获取服务价格
  getServicePrice() {
    const { serviceType, duration } = this.data;
    
    if (serviceType === 'basic') {
      return duration === 60 ? 299 : 439;
    } else if (serviceType === 'advanced') {
      return duration === 60 ? 399 : 579;
    }
    return 0;
  },

  // 增加赠送次数
  increaseGiftTimes() {
    this.setData({
      giftTimes: this.data.giftTimes + 1
    });
  },

  // 减少赠送次数
  decreaseGiftTimes() {
    if (this.data.giftTimes > 1) {
      this.setData({
        giftTimes: this.data.giftTimes - 1
      });
    }
  },

  // 输入赠送次数
  inputGiftTimes(e) {
    const times = parseInt(e.detail.value);
    if (!isNaN(times) && times > 0) {
      this.setData({
        giftTimes: times
      });
    } else {
      this.setData({
        giftTimes: 1
      });
    }
  },

  // 输入赠送原因
  inputReason(e) {
    this.setData({
      reason: e.detail.value
    });
  },

  // 确认赠送
  confirmGift() {
    if (!this.data.serviceType || !this.data.duration) {
      wx.showToast({
        title: '请选择服务项目和时长',
        icon: 'none'
      });
      return;
    }

    const servicePrice = this.getServicePrice();
    const totalValue = servicePrice * this.data.giftTimes;
    
    wx.showModal({
      title: '确认赠送',
      content: `您将向 ${this.data.userInfo.nickName || this.data.userInfo.phone} 赠送 ${this.data.giftTimes} 次 ${this.data.serviceType === 'basic' ? '基础拉伸' : '肌肉筋膜处理/运动训练'} (${this.data.duration}分钟)，总价值 ¥${totalValue}。`,
      success: (res) => {
        if (res.confirm) {
          this.saveGiftRecord();
        }
      }
    });
  },

  // 保存赠送记录
  saveGiftRecord() {
    // 获取当前员工信息
    const staffInfo = wx.getStorageSync('staffInfo');
    
    if (!staffInfo || !staffInfo._id) {
      wx.showToast({
        title: '请先登录员工账号',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '处理中...',
    });
    
    // 使用云函数处理赠送记录和更新用户次数
    wx.cloud.callFunction({
      name: 'giftService',
      data: {
        userId: this.data.userInfo._id,
        serviceType: this.data.serviceType,
        duration: this.data.duration,
        giftTimes: this.data.giftTimes,
        reason: this.data.reason,
        staffInfo: {
          _id: staffInfo._id,
          name: staffInfo.nickName || staffInfo.name || '员工'
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '赠送成功',
          icon: 'success'
        });
        
        // 返回到初始状态
        this.setData({
          step: 1,
          phoneNumber: '',
          userInfo: null,
          giftTimes: 1,
          reason: '',
          serviceType: '',
          duration: null
        });
        
        // 延迟一段时间后重新加载赠送记录
        setTimeout(() => {
          this.loadGiftRecords();
        }, 1000);
      } else {
        wx.showToast({
          title: res.result.message || '赠送失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('赠送失败:', err);
      
      wx.showToast({
        title: '赠送失败，请重试',
        icon: 'none'
      });
    });
  },

  // 返回上一页
  navigateBack() {
    wx.navigateBack();
  },

  loadStaffInfo() {
    const staffInfo = wx.getStorageSync('staffInfo');
    console.log('获取到的员工信息:', staffInfo);
    
    if (staffInfo && staffInfo.staff_id) {
      this.setData({ staffInfo });
      console.log('员工信息已设置, ID:', staffInfo.staff_id);
      // 加载赠送记录
      this.loadGiftRecords();
    } else {
      // 如果员工信息不完整，尝试从数据库重新获取
      const db = wx.cloud.database();
      const staffId = wx.getStorageSync('staffId');
      
      console.log('尝试使用staffId获取员工信息:', staffId);
      
      if (staffId) {
        this.getStaffFromDatabase(staffId);
      } else {
        wx.showToast({
          title: '未找到员工信息',
          icon: 'none',
          success: () => {
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }
        });
      }
    }
  },
  
  // 从数据库获取员工信息
  getStaffFromDatabase(staffId) {
    const db = wx.cloud.database();
    
    db.collection('staff')
      .where({ staff_id: staffId })
      .get()
      .then(res => {
        if (res.data.length > 0) {
          const staffInfo = res.data[0];
          
          // 更新缓存和页面数据
          wx.setStorageSync('staffInfo', staffInfo);
          wx.setStorageSync('staffId', staffId);
          this.setData({ staffInfo });
          
          console.log('已从数据库获取员工信息:', staffInfo);
          
          // 加载赠送记录
          this.loadGiftRecords();
        } else {
          wx.showToast({
            title: '员工ID不存在于数据库',
            icon: 'none'
          });
          this.showErrorAndGoBack();
        }
      })
      .catch(err => {
        console.error('获取员工信息失败:', err);
        this.showErrorAndGoBack();
      });
  },
  
  showErrorAndGoBack() {
    wx.showToast({
      title: '未找到员工信息',
      icon: 'none',
      success: () => {
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  }
})