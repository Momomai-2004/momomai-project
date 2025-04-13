Page({
  data: {
    dateList: [], // 日期列表
    currentDate: '', // 当前选中日期
    timeSlots: [], // 时间段列表
    selectedTimeSlot: null, // 选中的时间段
    therapistId: '',
    selectedDate: '', // 选择的日期
    selectedTime: '',
    selectedService: null,
    selectedServiceName: '', // 服务名称
    selectedDuration: 0, // 选择的时长
    selectedPrice: 0, // 选择的价格
    canGoNext: false, // 是否可以进入下一步
    therapistInfo: null,
    services: [], // 服务项目列表
    totalPrice: 0, // 总价格
    totalDuration: 0, // 总时长
    showPaymentModal: false,
    showWalletModal: false,
    walletBalance: 0,
    remainingSessions: 0,
    hasWalletBalance: false,
    hasAvailableSessions: false,
    bookedSlots: [], // 已预约的时间段
    showServiceModal: false, // 控制服务选择弹窗
    statusBarHeight: 0,
    hasSelectedService: false,
    selectedPayment: '',
    canUseWallet: false,
    userInfo: null,
    isLoggedIn: false,
    therapists: [],
    selectedTherapist: null
  },

  onLoad(options) {
    // 获取传递的理疗师ID
    if (options && options.therapistId) {
      this.setData({
        therapistId: options.therapistId
      });
    }
    
    this.checkLoginStatus();
    this.initDateList();
    
    // 如果有理疗师ID，则获取理疗师信息
    if (this.data.therapistId) {
      this.getTherapistInfo(this.data.therapistId);
    } else {
      this.getTherapists();
    }
  },

  onShow() {
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const userInfo = wx.getStorageSync('userInfo');

    if (!isLoggedIn) {
      wx.redirectTo({
        url: '/pages/login/account/account'
      });
      return;
    }

    this.setData({
      isLoggedIn,
      userInfo
    });

    // 加载预约相关数据
    this.loadBookingData();
  },

  loadBookingData() {
    const { therapistId } = this.data;
    
    this.initDateList();
  },

  // 初始化日期列表
  initDateList() {
    const today = new Date();
    const dateList = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      dateList.push({
        id: `date_${i}`,
        date: date,
        dateString: this.formatDate(date),
        day: this.formatDay(date),
        isToday: this.isToday(date)
      });
    }

    this.setData({
      dateList,
      selectedDate: dateList[0].dateString
    });

    this.loadBookedSlots(dateList[0].date);
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  formatDay(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  },

  // 选择日期
  onDateSelect(e) {
    const { date } = e.currentTarget.dataset;
    this.setData({ 
      selectedDate: date,
      selectedTime: '' // 切换日期时清空选中的时间
    });
    this.loadBookedSlots(date); // 先加载已预约时间段，然后会触发加载时间格子
  },

  // 加载已预约的时间段
  loadBookedSlots(date) {
    const db = wx.cloud.database();
    
    db.collection('appointments')
      .where({
        appointment_date: date,
        status: ['pending', 'confirmed'] // 只查询待确认和已确认的预约
      })
      .field({
        time_slot: true,
        service_duration: true
      })
      .get()
      .then(res => {
        const bookedSlots = [];
        res.data.forEach(appointment => {
          // 获取预约开始时间
          const [hour, minute] = appointment.time_slot.split(':');
          const startSlot = parseInt(hour) * 2 + (minute === '30' ? 1 : 0);
          
          // 根据服务时长计算占用的时间段数
          const slotsNeeded = Math.ceil(appointment.service_duration / 30);
          
          // 将占用的所有时间段加入数组
          for (let i = 0; i < slotsNeeded; i++) {
            bookedSlots.push(startSlot + i);
          }
        });

        this.setData({ bookedSlots });
        this.loadTimeSlots(new Date(date));
      });
  },

  // 加载时间段
  loadTimeSlots(date) {
    const now = new Date();
    const selectedDate = new Date(date);
    const isToday = this.isToday(selectedDate);
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    const timeSlots = [];
    const startHour = 10; // 早上10点开始
    const endHour = 22;   // 晚上10点结束
    
    let slotIndex = 0;
    for (let hour = startHour; hour < endHour; hour++) {
      // 每小时2个时间段
      ['00', '30'].forEach(minutes => {
        const timeString = `${hour.toString().padStart(2, '0')}:${minutes}`;
        
        // 计算当前时间与预约时间的差距（分钟）
        const slotTimeMinutes = hour * 60 + parseInt(minutes);
        const currentTimeMinutes = currentHour * 60 + currentMinutes;
        const minutesDifference = slotTimeMinutes - currentTimeMinutes;
        
        // 检查是否过时（今天的时间段）或未提前足够时间预约
        const isPastTime = isToday && (minutesDifference < 60); // 必须至少提前一小时预约
        
        // 检查是否被预约
        const isBooked = this.data.bookedSlots.includes(slotIndex);
        
        timeSlots.push({
          id: `time_${slotIndex}`,
          time: timeString,
          disabled: isPastTime || isBooked,
          booked: isBooked
        });
        
        slotIndex++;
      });
    }

    this.setData({ timeSlots });
  },

  // 检查时间段是否可用
  checkTimeSlotAvailability(startIndex, duration) {
    const timeSlots = this.data.timeSlots;
    const endIndex = startIndex + (duration / 60) - 1;
    
    // 检查范围是否有效
    if (endIndex >= timeSlots.length) {
      return false;
    }
    
    // 检查所有时间段是否可用
    for (let i = startIndex; i <= endIndex; i++) {
      if (timeSlots[i].disabled || timeSlots[i].booked) {
        return false;
      }
    }
    
    return true;
  },

  // 选择时间段
  selectTimeSlot(e) {
    const index = e.currentTarget.dataset.index;
    const timeSlots = this.data.timeSlots;
    
    if (timeSlots[index].disabled || timeSlots[index].booked) {
      return;
    }

    this.setData({ selectedTimeSlot: index });
  },

  // 日期相关辅助函数
  getDateFromString(dateString) {
    const [month, day] = dateString.split('/');
    const date = new Date();
    date.setMonth(parseInt(month) - 1);
    date.setDate(parseInt(day));
    return date;
  },

  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  },

  // 加载服务项目
  loadServices() {
    // 这里添加加载服务项目的逻辑
  },

  // 切换服务选择状态
  toggleService(e) {
    const id = e.currentTarget.dataset.id;
    const services = this.data.services;
    const service = services.find(s => s.id === id);
    service.selected = !service.selected;
    
    const selectedServices = services.filter(s => s.selected);
    const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
    const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
    
    this.setData({
      services,
      totalDuration,
      totalPrice,
      hasSelectedService: selectedServices.length > 0
    });
  },

  // 计算总计
  calculateTotal() {
    const services = this.data.services;
    const selectedServices = services.filter(s => s.selected);
    
    const totalDuration = selectedServices.reduce((sum, service) => sum + service.duration, 0);
    const totalPrice = selectedServices.reduce((sum, service) => sum + service.price, 0);
    
    this.setData({
      totalDuration,
      totalPrice
    });
  },

  // 处理钱包支付
  processWalletPayment() {
    // 处理钱包支付逻辑
    wx.showLoading({
      title: '处理中...'
    });
    
    // 这里添加钱包支付的具体逻辑
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '支付成功',
        icon: 'success'
      });
    }, 1000);
  },

  // 处理微信支付
  processWechatPayment() {
    // 处理微信支付逻辑
    wx.showLoading({
      title: '调起支付...'
    });

    // 这里添加微信支付的具体逻辑
    wx.requestPayment({
      timeStamp: '',
      nonceStr: '',
      package: '',
      signType: 'MD5',
      paySign: '',
      success: () => {
        wx.showToast({
          title: '支付成功',
          icon: 'success'
        });
      },
      fail: () => {
        wx.showToast({
          title: '支付失败',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到服务选择页面
  goToServiceSelect() {
    if (!this.data.selectedTime) {
      wx.showToast({
        title: '请选择时间',
        icon: 'none'
      });
      return;
    }

    // 获取理疗师信息并传递
    const therapistInfo = this.data.selectedTherapist || {};
    
    wx.navigateTo({
      url: `/pages/service-select/service-select?date=${this.data.selectedDate}&time=${this.data.selectedTime}&therapistId=${this.data.therapistId}&therapistName=${therapistInfo.name || ''}`
    });
  },

  // 添加时间选择处理方法
  onTimeSelect(e) {
    const { time, index } = e.currentTarget.dataset;
    
    // 检查后续时间段是否可用
    const serviceDuration = 60; // 默认60分钟，可以根据实际选择的服务调整
    const slotsNeeded = serviceDuration / 30;
    
    // 检查是否有足够的连续空闲时间段
    for (let i = 0; i < slotsNeeded; i++) {
      if (this.data.timeSlots[parseInt(index) + i]?.disabled) {
        wx.showToast({
          title: '该时段无法预约完整服务时长',
          icon: 'none'
        });
        return;
      }
    }
    
    this.setData({ selectedTime: time });
  },

  // 获取指定理疗师信息
  getTherapistInfo(therapistId) {
    const db = wx.cloud.database();
    
    wx.showLoading({
      title: '加载中...',
    });
    
    db.collection('therapists')
      .doc(therapistId)
      .get()
      .then(res => {
        wx.hideLoading();
        if (res.data) {
          this.setData({
            selectedTherapist: res.data,
            services: res.data.service_types || []
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取理疗师信息失败:', err);
        wx.showToast({
          title: '获取理疗师信息失败',
          icon: 'none'
        });
        
        // 如果获取失败，尝试获取所有理疗师
        this.getTherapists();
      });
  },

  // 获取所有理疗师
  getTherapists() {
    const db = wx.cloud.database();
    
    wx.showLoading({
      title: '加载中...',
    });
    
    db.collection('therapists')
      .where({
        status: 'active',
        is_staff: true,
        role: 'therapist'
      })
      .get()
      .then(res => {
        wx.hideLoading();
        if (res.data && res.data.length > 0) {
          this.setData({
            therapists: res.data,
            // 如果没有选择理疗师，默认选择第一个
            selectedTherapist: this.data.selectedTherapist || res.data[0],
            services: this.data.selectedTherapist ? 
              this.data.selectedTherapist.service_types : 
              (res.data[0].service_types || [])
          });
        } else {
          this.fallbackGetTherapists();
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('获取理疗师列表失败:', err);
        this.fallbackGetTherapists();
      });
  },

  // 备用方法：使用静态数据
  fallbackGetTherapists() {
    const defaultTherapists = [
      {
        _id: 'staff001',
        name: '张教练',
        avatar: '/images/memoji-a.png',
        service_types: [
          {
            type: 'basic_60',
            name: '基础拉伸60分钟',
            price: 299,
            duration: 60
          },
          {
            type: 'basic_90',
            name: '基础拉伸90分钟',
            price: 439,
            duration: 90
          },
          {
            type: 'advanced_60',
            name: '肌肉筋膜处理60分钟',
            price: 399,
            duration: 60
          },
          {
            type: 'advanced_90',
            name: '肌肉筋膜处理90分钟',
            price: 579,
            duration: 90
          }
        ]
      },
      {
        _id: 'staff002',
        name: 'B',
        avatar: '/images/memoji-b.png',
        service_types: [
          {
            type: 'basic_60',
            name: '基础拉伸60分钟',
            price: 299,
            duration: 60
          },
          {
            type: 'basic_90',
            name: '基础拉伸90分钟',
            price: 439,
            duration: 90
          },
          {
            type: 'advanced_60',
            name: '肌肉筋膜处理60分钟',
            price: 399,
            duration: 60
          },
          {
            type: 'advanced_90',
            name: '肌肉筋膜处理90分钟',
            price: 579,
            duration: 90
          }
        ]
      },
      {
        _id: 'staff003',
        name: 'C',
        avatar: '/images/memoji-c.png',
        service_types: [
          {
            type: 'basic_60',
            name: '基础拉伸60分钟',
            price: 299,
            duration: 60
          },
          {
            type: 'basic_90',
            name: '基础拉伸90分钟',
            price: 439,
            duration: 90
          },
          {
            type: 'advanced_60',
            name: '肌肉筋膜处理60分钟',
            price: 399,
            duration: 60
          },
          {
            type: 'advanced_90',
            name: '肌肉筋膜处理90分钟',
            price: 579,
            duration: 90
          }
        ]
      }
    ];

    // 设置默认理疗师数据
    this.setData({
      therapists: defaultTherapists,
      selectedTherapist: defaultTherapists[0],
      services: defaultTherapists[0].service_types || []
    });
  },

  // 选择理疗师
  selectTherapist(e) {
    const { id } = e.currentTarget.dataset;
    const therapist = this.data.therapists.find(t => t._id === id);
    
    if (therapist) {
      this.setData({
        selectedTherapist: therapist,
        services: therapist.service_types || []
      });
    }
  },

  // 选择服务
  selectService(e) {
    const service = e.currentTarget.dataset.service;
    if (!service) return;
    
    console.log('选择服务:', service);
    
    // 设置选中的服务
    this.setData({
      selectedService: service,
      selectedServiceName: service.name,
      selectedDuration: service.duration || 60,
      selectedPrice: service.price || 0,
      canGoNext: !!this.data.selectedTime,
      totalPrice: service.price || 0,
      totalDuration: service.duration || 60
    });
    
    // 关闭服务选择弹窗（如果打开）
    if (this.data.showServiceModal) {
      this.setData({
        showServiceModal: false
      });
    }
  },
});