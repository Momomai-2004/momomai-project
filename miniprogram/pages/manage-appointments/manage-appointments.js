const app = getApp();
const db = wx.cloud.database();
const appointmentsCollection = db.collection('appointments');
const MAX_LIMIT = 20; // 单次查询最大数量限制

Page({
  /**
   * 页面的初始数据
   */
  data: {
    isInit: false,
    isLoggedIn: false,
    staffInfo: null,
    appointments: [],
    filteredAppointments: [],
    isLoading: true,
    activeTab: 'today',
    activeTabText: '今日',
    searchQuery: '',
    selectedFilter: 'all',
    isFilterOpen: false,
    filterOptions: {
      'all': '全部状态',
      'pending': '待确认',
      'confirmed': '已确认',
      'paid': '已支付',
      'completed': '已完成',
      'cancelled': '已取消'
    },
    statusTexts: {
      'pending': '待确认',
      'confirmed': '已确认',
      'paid': '已支付',
      'completed': '已完成',
      'cancelled': '已取消'
    },
    stats: {
      pending: 0,
      confirmed: 0,
      today: 0
    },
    lastRefreshTime: '',
    connectionStatus: 'normal', // 'normal', 'error'
    connectionMessage: '正在连接...',
    autoRefreshEnabled: true,
    retryCount: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('管理预约页面加载', options);
    this.initializePage();
    
    // 添加延迟的页面完整性检查
    setTimeout(() => {
      this.checkPageIntegrity();
    }, 1500);
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('管理预约页面显示');
    this.checkLoginStatus();
    if (this.data.isLoggedIn) {
      console.log('已登录，加载预约数据');
      this.loadAppointments();
    } else {
      console.log('未登录，显示登录提示');
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function() {
    // 页面隐藏时清除自动刷新定时器
    this.clearAutoRefreshTimer();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    // 页面卸载时清除自动刷新定时器
    this.clearAutoRefreshTimer();
  },

  /**
   * 登录相关
   */
  checkLoginStatus() {
    const staffInfo = wx.getStorageSync('staffInfo');
    if (staffInfo && staffInfo._id) {
    this.setData({
        isLoggedIn: true,
        staffInfo
      });
    } else {
      this.setData({
        isLoggedIn: false,
        staffInfo: null
      });
    }
  },

  /**
   * 前往员工登录页
   */
  goToStaffLogin: function () {
    console.log('跳转到员工登录页');
    
    // 设置一个标志，登录成功后自动返回预约管理页
    wx.setStorageSync('loginReturnPage', '/pages/manage-appointments/manage-appointments');
    
    wx.navigateTo({
      url: '/pages/login/staff/staff',
      success: () => {
        console.log('成功跳转到员工登录页');
      },
      fail: (err) => {
        console.error('跳转到员工登录页失败:', err);
        wx.showToast({
          title: '无法跳转到登录页，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 切换标签
   */
  switchTab: function (e) {
    const tab = e.currentTarget.dataset.tab;
    const tabTexts = {
      'today': '今日',
      'upcoming': '未来',
      'all': '所有'
    };
    
    this.setData({ 
      activeTab: tab,
      activeTabText: tabTexts[tab],
      selectedFilter: 'all',
      searchQuery: '',
      isFilterOpen: false,
      isLoading: true
    });
    
    this.loadAppointments();
  },

  /**
   * 加载预约数据
   */
  async loadAppointments(isPullDown = false) {
    if (!this.data.isLoggedIn) return;
    
    if (!isPullDown) {
      this.setData({ isLoading: true });
    }
    
    try {
      // 获取员工ID
      const staffId = this.data.staffInfo._id;
      if (!staffId) {
        throw new Error('员工ID不存在');
      }
      
      console.log('正在调用云函数获取预约数据，staffId:', staffId, '当前activeTab:', this.data.activeTab);
      
      // 云函数查询
      const result = await wx.cloud.callFunction({
        name: 'getStaffAppointments',
        data: {
          staffId,
          tab: this.data.activeTab
        }
      });
      
      console.log('云函数返回结果:', JSON.stringify(result));
      
      // 检查返回的data，直接处理，不要抛错
      if (result && result.result) {
        const resultData = result.result;
        
        // 检查成功状态
        if (!resultData.success) {
          console.warn('云函数返回失败状态:', resultData.message, '错误详情:', resultData.error);
          
          // 显示具体错误
          this.setData({
            connectionStatus: 'error',
            connectionMessage: '云函数错误: ' + (resultData.message || '未知错误')
          });
          
          // 尝试备用方案
          this.fallbackQueryAppointments();
          return;
        }
        
        // 获取appointment数组 - 从appointments字段获取数据，如果没有则尝试data字段
        let appointments = [];
        if (resultData.appointments && Array.isArray(resultData.appointments)) {
          appointments = resultData.appointments;
          console.log('从appointments字段获取了数据');
        } else if (resultData.data && Array.isArray(resultData.data)) {
          appointments = resultData.data;
          console.log('从data字段获取了数据');
        } else {
          console.log('未找到预约数据，result结构:', JSON.stringify(resultData));
        }
        
        console.log('从云函数获取的预约数量:', appointments.length, '第一条数据示例:', appointments.length > 0 ? JSON.stringify(appointments[0]) : '无数据');
        
        if (appointments && appointments.length > 0) {
          // 处理预约数据
          appointments = appointments.map(item => this.formatAppointmentData(item));
          
          // 计算统计数据
          const stats = this.calculateStats(appointments);
          
          console.log('处理后的预约数据示例:', appointments.length > 0 ? JSON.stringify(appointments[0]) : '无数据');
          
          // 过滤预约数据
          const filteredAppointments = this.filterAppointments(appointments, this.data.searchQuery, this.data.selectedFilter);
          console.log('过滤后的预约数据数量:', filteredAppointments.length);
          
          // 更新数据
          this.setData({
            appointments,
            filteredAppointments,
            isLoading: false,
            stats,
            lastRefreshTime: this.formatTime(new Date()),
            connectionStatus: 'normal',
            connectionMessage: `成功获取${appointments.length}条预约数据`
          }, () => {
            console.log('数据已更新到页面，appointments:', this.data.appointments.length, 'filteredAppointments:', this.data.filteredAppointments.length);
          });
        } else {
          console.log('云函数返回的预约数据为空');
          // 没有数据
          this.setData({
            appointments: [],
            filteredAppointments: [],
            isLoading: false,
            stats: this.countAppointmentStats([]),
            lastRefreshTime: this.formatTime(new Date()),
            connectionStatus: 'normal',
            connectionMessage: '暂无预约数据'
          }, () => {
            console.log('没有预约数据，已更新UI');
          });
        }
      } else {
        // 返回数据不符合预期
        console.error('云函数返回数据格式不正确:', result);
        throw new Error('数据格式不正确');
      }
    } catch (error) {
      console.error('获取预约数据失败:', error);
      
      // 设置错误状态
      this.setData({
        isLoading: false,
        connectionStatus: 'error',
        connectionMessage: '获取预约失败: ' + (error.message || '未知错误')
      });
      
      // 尝试备用方案
      this.fallbackQueryAppointments();
    } finally {
      // 如果是下拉刷新，停止刷新动画
      if (isPullDown) {
        wx.stopPullDownRefresh();
      }
      
      // 启动自动刷新
      this.startAutoRefresh();
    }
  },

  /**
   * 统计预约数量
   */
  countAppointmentStats: function(appointments) {
    const stats = {
      today: 0,
      pending: 0,
      confirmed: 0,
      upcoming: 0,
      completed: 0,
      cancelled: 0
    };
    
    if (!appointments || !appointments.length) {
      return stats;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 一周后的日期
    const oneWeekLater = new Date(today);
    oneWeekLater.setDate(oneWeekLater.getDate() + 7);
    
    appointments.forEach(appointment => {
      // 将预约时间字符串转为日期对象
      const appointmentDate = new Date(appointment.date || appointment.appointmentDate);
      appointmentDate.setHours(0, 0, 0, 0);
      
      // 统计今天的预约
      if (appointmentDate.getTime() === today.getTime()) {
        stats.today++;
      }
      
      // 统计未来一周内的预约
      if (appointmentDate >= today && appointmentDate < oneWeekLater) {
        stats.upcoming++;
      }
      
      // 根据状态统计
      if (appointment.status) {
        if (stats[appointment.status] !== undefined) {
          stats[appointment.status]++;
        }
      }
    });
    
    return stats;
  },

  /**
   * 备用方案：客户端查询
   */
  async fallbackQueryAppointments() {
    try {
      console.log('使用本地查询方式获取预约数据');
      const staffId = this.data.staffInfo._id;
    
    if (!staffId) {
        console.error('员工ID不存在');
        return;
      }
      
      const db = wx.cloud.database();
      
      // 首先尝试获取所有集合
      const collections = await db.collection('appointments').count().catch(err => {
        console.log('查询appointments集合失败:', err);
        return { total: 0 };
      });
      
      if (collections.total === 0) {
        console.log('appointments集合可能不存在或为空');
        this.setData({
          appointments: [],
          filteredAppointments: [],
          lastRefreshTime: this.formatTime(new Date()) + ' (本地 - 无数据)',
          connectionMessage: 'appointments集合不存在或为空'
        });
      return;
    }
    
    // 构建查询条件
    let whereCondition = {
        staffId: staffId
      };
      
      // 也可能使用旧字段名 (兼容旧数据)
      const possibleStaffIdFields = ['staffId', 'therapist_id', 'staff_id'];
      let query = null;
      
      // 尝试不同的字段名
      for (const fieldName of possibleStaffIdFields) {
        console.log(`尝试使用 ${fieldName} 字段查询`);
        
        const tempCondition = {};
        tempCondition[fieldName] = staffId;
        
        // 查询数量
        const countResult = await db.collection('appointments')
          .where(tempCondition)
      .count()
          .catch(err => ({ total: 0 }));
          
        if (countResult.total > 0) {
          console.log(`找到使用 ${fieldName} 字段的 ${countResult.total} 条记录`);
          query = tempCondition;
          break;
        }
      }
      
      if (!query) {
        console.log('未找到该员工的预约记录');
        this.setData({
          appointments: [],
          filteredAppointments: [],
          lastRefreshTime: this.formatTime(new Date()) + ' (本地 - 无数据)',
          connectionMessage: '未找到该员工的预约记录'
        });
        return;
      }
      
      // 根据当前选项卡添加日期条件
      const today = this.formatDate(new Date());
      
      if (this.data.activeTab === 'today') {
        // 今日预约：添加日期等于今天的条件
        query.date = today;
      } else if (this.data.activeTab === 'upcoming') {
        // 未来预约：添加日期大于今天的条件
        const todayDate = new Date();
        const nextWeek = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const nextWeekStr = this.formatDate(nextWeek);
        
        const db = wx.cloud.database();
        const _ = db.command;
        
        query = _.and([
          query,
          { date: _.gt(today) },
          { date: _.lte(nextWeekStr) }
        ]);
      }
      
      // 查询预约数据
      const { data } = await db.collection('appointments')
        .where(query)
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .limit(MAX_LIMIT)
        .get();
      
      console.log(`本地查询成功，获取到 ${data.length} 条预约`);
      
      // 更新统计数据
      const stats = this.calculateStats(data);
            
            this.setData({
        appointments: data,
        filteredAppointments: this.filterAppointments(data, this.data.searchQuery, this.data.selectedFilter),
        stats,
        lastRefreshTime: this.formatTime(new Date()) + ' (本地查询)',
        connectionMessage: `本地查询成功，获取到 ${data.length} 条预约`
      });
    } catch (error) {
      console.error('备用查询失败:', error);
        wx.showToast({
        title: '加载数据失败',
          icon: 'none'
        });
    }
  },
  
  // 计算统计数据
  calculateStats(appointments) {
    const today = this.formatDate(new Date());
    
    const stats = {
      pending: 0,
      confirmed: 0,
      today: 0
    };
    
    appointments.forEach(item => {
      if (item.status === 'pending') {
        stats.pending++;
      } else if (item.status === 'confirmed' || item.status === 'paid') {
        stats.confirmed++;
      }
      
      if (item.date === today) {
        stats.today++;
      }
    });
    
    return stats;
  },

  /**
   * 搜索输入事件处理
   */
  onSearchInput: function(e) {
    const searchQuery = e.detail.value.trim();
    this.setData({
      searchQuery: searchQuery
    });
    
    // 根据当前搜索关键词过滤预约
    this.setData({
      filteredAppointments: this.filterAppointments(this.data.appointments, searchQuery, this.data.selectedFilter)
    });
  },

  /**
   * 清除搜索内容
   */
  clearSearch: function() {
    this.setData({
      searchQuery: '',
      filteredAppointments: this.filterAppointments(this.data.appointments, '', this.data.selectedFilter)
    });
  },

  /**
   * 格式化预约数据
   */
  formatAppointmentData: function(appointment) {
    try {
      console.log('格式化预约数据:', JSON.stringify(appointment));
      
      // 创建一个新对象，避免修改原始数据
      const formatted = {...appointment};
      
      // 格式化日期和时间
      const dateValue = formatted.date || formatted.appointment_date || formatted.appointmentDate;
      if (dateValue) {
        try {
          const date = new Date(dateValue);
          formatted.formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
          formatted.date = formatted.formattedDate; // 确保date字段存在
        } catch (e) {
          console.error('日期格式化错误:', e, dateValue);
          formatted.formattedDate = dateValue; // 保留原始值
          formatted.date = dateValue;
        }
      }
      
      // 确保状态字段存在
      if (!formatted.status) {
        formatted.status = 'pending';
      }
      
      // 保证客户姓名和电话字段存在
      formatted.customerName = formatted.customerName || formatted.user_name || formatted.name || '未知客户';
      formatted.customerPhone = formatted.customerPhone || formatted.user_phone || formatted.phone || '无电话';
      
      // 确保服务名称字段存在
      formatted.serviceName = formatted.serviceName || formatted.service_name || formatted.service || '未知服务';
      
      // 确保价格字段存在
      formatted.price = formatted.price || 0;
      
      // 格式化开始和结束时间
      formatted.startTime = formatted.startTime || formatted.time_slot || '00:00';
      
      // 计算结束时间（如果没有提供）
      if (!formatted.endTime) {
        if (formatted.service_duration) {
          // 基于开始时间和持续时间计算结束时间
          const startParts = formatted.startTime.split(':').map(Number);
          const startMinutes = startParts[0] * 60 + startParts[1];
          const endMinutes = startMinutes + parseInt(formatted.service_duration);
          const endHours = Math.floor(endMinutes / 60) % 24;
          const endMins = endMinutes % 60;
          formatted.endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
        } else {
          formatted.endTime = formatted.startTime;
        }
      }
      
      // 添加治疗师信息
      formatted.therapistId = formatted.therapistId || formatted.therapist_id || formatted.staff_id;
      formatted.therapistName = formatted.therapistName || formatted.therapist_name || '';
      formatted.therapistTitle = formatted.therapistTitle || formatted.therapist_title || '';
      formatted.therapistAvatar = formatted.therapistAvatar || formatted.therapist_avatar || '';
      
      console.log('格式化后的预约数据:', JSON.stringify(formatted));
      return formatted;
    } catch (error) {
      console.error('格式化预约数据失败:', error, '原始数据:', appointment);
      // 返回一个基本的对象，避免后续处理出错
      return {
        ...appointment,
        customerName: appointment.user_name || appointment.name || '未知客户',
        customerPhone: appointment.user_phone || appointment.phone || '无电话',
        serviceName: appointment.service_name || appointment.service || '未知服务',
        formattedDate: appointment.appointment_date || appointment.date || '未知日期',
        startTime: appointment.time_slot || '00:00',
        endTime: '00:00',
        status: appointment.status || 'pending'
      };
    }
  },

  /**
   * 根据搜索和过滤条件过滤预约
   */
  filterAppointments: function(appointments, searchQuery, statusFilter) {
    console.log('进入过滤函数，参数:', {
      appointmentsLength: appointments ? appointments.length : 0, 
      searchQuery, 
      statusFilter
    });
    
    if (!appointments || !Array.isArray(appointments)) {
      console.error('过滤预约时appointments不是数组', appointments);
      return [];
    }
    
    let filtered = [...appointments];
    
    // 打印第一条数据，便于调试
    if (filtered.length > 0) {
      console.log('过滤函数接收到的第一条数据:', JSON.stringify(filtered[0]));
    }
    
    // 如果有搜索关键词，先按关键词过滤
    if (searchQuery) {
      searchQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        // 检查多个字段是否包含搜索关键词
        return (
          (item.customerName && item.customerName.toLowerCase().includes(searchQuery)) ||
          (item.customerPhone && item.customerPhone.includes(searchQuery)) ||
          (item.serviceName && item.serviceName.toLowerCase().includes(searchQuery)) ||
          (item.notes && item.notes.toLowerCase().includes(searchQuery))
        );
      });
    }
    
    // 根据状态过滤
    if (statusFilter && statusFilter !== 'all') {
      console.log('按状态过滤:', statusFilter);
      filtered = filtered.filter(item => item.status === statusFilter);
    }
    
    // 排序: 默认按日期升序，同一天内按时间升序
    filtered.sort((a, b) => {
      // 首先按日期排序
      const dateA = a.date || a.appointment_date || a.appointmentDate || '';
      const dateB = b.date || b.appointment_date || b.appointmentDate || '';
      
      // 将字符串日期转换为日期对象
      const dateObjA = dateA ? new Date(dateA) : new Date(0);
      const dateObjB = dateB ? new Date(dateB) : new Date(0);
      
      if (dateObjA.getTime() !== dateObjB.getTime()) {
        return dateObjA - dateObjB;
      }
      
      // 同一天，按开始时间排序
      const timeA = a.startTime || a.time_slot || '';
      const timeB = b.startTime || b.time_slot || '';
      
      if (timeA && timeB) {
        return timeA.localeCompare(timeB);
      }
      
      return 0;
    });
    
    console.log('过滤后结果数量:', filtered.length);
    return filtered;
  },

  /**
   * 筛选功能
   */
  toggleFilter: function () {
    this.setData({
      isFilterOpen: !this.data.isFilterOpen
    });
    
    if (this.data.isFilterOpen) {
      // 显示筛选选项面板
      wx.showActionSheet({
        itemList: Object.values(this.data.filterOptions),
        success: (res) => {
          const filterKeys = Object.keys(this.data.filterOptions);
          const selectedFilter = filterKeys[res.tapIndex];
          
          this.setData({
            selectedFilter,
            isFilterOpen: false,
            filteredAppointments: this.filterAppointments(this.data.appointments, this.data.searchQuery, selectedFilter)
          });
        },
        fail: () => {
          this.setData({
            isFilterOpen: false
          });
        }
      });
    }
  },

  /**
   * 格式化日期
   */
  formatDate: function (date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * 格式化时间
   */
  formatTime: function (date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 拨打客户电话
   */
  callCustomer: function (e) {
    const phone = e.currentTarget.dataset.phone;
    if (!phone) return;
    
    wx.makePhoneCall({
      phoneNumber: phone,
      fail(err) {
        console.error('拨打电话失败:', err);
      }
    });
  },
  
  /**
   * 自动诊断函数
   */
  autoDiagnose: function() {
    const that = this;
    console.log('开始自动诊断...');
    
    // 1. 检查网络连接
    wx.getNetworkType({
      success(res) {
        const networkType = res.networkType;
        console.log('网络类型:', networkType);
        
        if (networkType === 'none') {
          that.setData({ connectionStatus: 'error' });
          console.log('⚠️ 网络连接异常');
        } else {
          // 2. 检查数据库连接
          that.checkCloudConnection();
        }
      }
    });
    
    // 3. 分析数据
    const { appointments } = that.data;
    if (appointments && appointments.length > 0) {
      console.log(`已加载 ${appointments.length} 条预约记录`);
      
      // 查找今日即将开始的预约
      const upcomingAppointments = appointments.filter(function(item) {
        return that.isToday(item.date) && 
              that.isWithin30Minutes(item.startTime) &&
              (item.status === 'confirmed' || item.status === 'paid');
      });
      
      if (upcomingAppointments.length > 0) {
        console.log(`有 ${upcomingAppointments.length} 个预约即将开始`);
      }
    }
  },
  
  // 检查云环境连接
  async checkCloudConnection() {
    try {
      console.log('开始检查云环境连接...');
      const res = await wx.cloud.callFunction({
        name: 'checkConnection',
        data: {}
      });
      
      console.log('云环境连接检查结果:', res);
      
      if (res && res.result && res.result.success) {
        this.setData({
          connectionStatus: 'normal',
          connectionMessage: '云环境连接正常'
        });
        console.log('✅ 云环境连接正常, 可用集合:', res.result.collections);
      } else {
        // 连接成功但返回错误状态
        this.setData({ 
          connectionStatus: 'error',
          connectionMessage: res.result.message || '云环境连接异常'
        });
        console.log('⚠️ 云环境连接异常 - 返回结果不符合预期:', res.result.error);
        
        // 尝试备用查询方法
        this.fallbackQueryAppointments();
      }
    } catch (error) {
      // 连接失败
      console.error('检查云环境连接失败:', error);
      this.setData({ 
        connectionStatus: 'error',
        connectionMessage: '云环境连接失败: ' + (error.message || '未知错误')
      });
      
      // 尝试备用查询方法
      this.fallbackQueryAppointments();
    }
  },

  // 检查即将到来的预约
  isToday: function(dateStr) {
    const today = this.formatDate(new Date());
    return dateStr === today;
  },
  
  // 检查即将到来的预约
  isWithin30Minutes: function(timeStr) {
    if (!timeStr) return false;
    
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // 计算当前时间与预约时间的分钟差
    const currentTotalMinutes = currentHours * 60 + currentMinutes;
    const appointmentTotalMinutes = hours * 60 + minutes;
    const diffMinutes = appointmentTotalMinutes - currentTotalMinutes;
    
    // 如果预约时间在当前时间的30分钟内，且尚未过期
    return diffMinutes >= 0 && diffMinutes <= 30;
  },

  // 确认预约
  async confirmAppointment(e) {
    const id = e.currentTarget.dataset.id;
    wx.showLoading({ title: '正在确认...' });
    
    try {
      await wx.cloud.callFunction({
        name: 'updateAppointmentStatus',
          data: {
          id,
          status: 'confirmed',
          staffId: this.data.staffInfo._id,
          staffName: this.data.staffInfo.name
        }
      });
      
      // 更新本地数据
      this.updateLocalAppointment(id, { status: 'confirmed' });
      
        wx.showToast({
        title: '预约已确认',
          icon: 'success'
        });
    } catch (error) {
      console.error('确认预约失败:', error);
      wx.showToast({
        title: '确认失败，请重试',
        icon: 'none'
      });
    } finally {
        wx.hideLoading();
    }
  },
  
  // 一键确认所有待处理预约
  async confirmAllPending() {
    const pendingAppointments = this.data.appointments.filter(a => a.status === 'pending');
    
    if (pendingAppointments.length === 0) {
        wx.showToast({
        title: '暂无待确认预约',
          icon: 'none'
        });
      return;
    }
    
    wx.showModal({
      title: '批量确认',
      content: `确定要一键确认${pendingAppointments.length}个待处理预约吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '批量确认中...' });
          
          try {
            await wx.cloud.callFunction({
              name: 'batchUpdateAppointments',
              data: {
                appointmentIds: pendingAppointments.map(a => a._id),
                status: 'confirmed',
                staffId: this.data.staffInfo._id,
                staffName: this.data.staffInfo.name
              }
            });
            
            // 更新本地数据
            const updatedAppointments = this.data.appointments.map(item => {
              if (item.status === 'pending') {
                return { ...item, status: 'confirmed' };
              }
              return item;
            });
            
            const stats = this.calculateStats(updatedAppointments);
            
            this.setData({
              appointments: updatedAppointments,
              filteredAppointments: this.filterAppointments(updatedAppointments, this.data.selectedFilter, this.data.searchQuery),
              stats
            });
            
            wx.showToast({
              title: '批量确认成功',
              icon: 'success'
            });
          } catch (error) {
            console.error('批量确认失败:', error);
            wx.showToast({
              title: '批量确认失败',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
      });
  },
  
  // 取消预约
  cancelAppointment: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '取消预约',
      content: '确定要取消这个预约吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '取消中...' });
          
          try {
            await wx.cloud.callFunction({
              name: 'updateAppointmentStatus',
              data: {
                id,
                status: 'cancelled',
                staffId: this.data.staffInfo._id,
                staffName: this.data.staffInfo.name
              }
            });
            
            // 更新本地数据
            this.updateLocalAppointment(id, { status: 'cancelled' });
            
            wx.showToast({
              title: '预约已取消',
              icon: 'success'
            });
          } catch (error) {
            console.error('取消预约失败:', error);
            wx.showToast({
              title: '取消失败，请重试',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },
  
  // 完成预约服务
  async completeService(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '完成服务',
      content: '确定要将此预约标记为已完成吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '正在处理...' });
          
          try {
            await wx.cloud.callFunction({
              name: 'updateAppointmentStatus',
        data: {
                id,
                status: 'completed',
                staffId: this.data.staffInfo._id,
                staffName: this.data.staffInfo.name,
                completeTime: new Date().toISOString()
              }
            });
            
            // 更新本地数据
            this.updateLocalAppointment(id, { 
              status: 'completed',
              completeTime: new Date().toISOString()
            });
            
        wx.showToast({
              title: '服务已完成',
          icon: 'success'
        });
          } catch (error) {
            console.error('完成服务失败:', error);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },
  
  // 修改预约
  changeAppointment: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    
    wx.navigateTo({
      url: `/pages/edit-appointment/edit-appointment?id=${appointment._id}`
    });
  },
  
  // 查看预约详情
  viewAppointmentDetail: function (e) {
    const appointment = e.currentTarget.dataset.appointment;
    
    // 格式化预约详情
    const detail = {
      serviceName: appointment.serviceName,
      date: appointment.date,
      time: `${appointment.startTime} - ${appointment.endTime}`,
      status: this.data.statusTexts[appointment.status],
      price: appointment.price,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      therapistName: appointment.therapistName || '未分配',
      therapistTitle: appointment.therapistTitle || '',
      notes: appointment.notes || '无',
      createdAt: appointment.createdAt || '未知',
      updatedAt: appointment.updatedAt || '未知'
    };
    
    // 构建详情显示内容
    let content = `服务: ${detail.serviceName}\n`;
    content += `日期: ${detail.date}\n`;
    content += `时间: ${detail.time}\n`;
    content += `状态: ${detail.status}\n`;
    content += `价格: ¥${detail.price}\n`;
    content += `客户: ${detail.customerName}\n`;
    content += `电话: ${detail.customerPhone}\n`;
    content += `治疗师: ${detail.therapistName}\n`;
    
    if (detail.therapistTitle) {
      content += `职称: ${detail.therapistTitle}\n`;
    }
    
    if (detail.notes !== '无') {
      content += `备注: ${detail.notes}\n`;
    }
    
    // 显示详情弹窗
    wx.showModal({
      title: '预约详情',
      content: content,
      showCancel: false,
      confirmText: '关闭'
    });
  },
  
  // 更新本地预约数据
  updateLocalAppointment: function (id, newData) {
        const { appointments } = this.data;
    const index = appointments.findIndex(item => item._id === id);
    
    if (index !== -1) {
      const updatedAppointments = [...appointments];
      updatedAppointments[index] = { 
        ...updatedAppointments[index], 
        ...newData 
      };
      
      const stats = this.calculateStats(updatedAppointments);
      
      this.setData({
        appointments: updatedAppointments,
        filteredAppointments: this.filterAppointments(updatedAppointments, this.data.selectedFilter, this.data.searchQuery),
        stats
      });
    }
  },

  /**
   * 设置连接错误状态
   */
  setConnectionError: function(errorMsg) {
    this.setData({
      isLoading: false,
      connectionStatus: 'error'
    });
    
    wx.showToast({
      title: errorMsg || '连接出错',
      icon: 'none',
      duration: 2000
    });
    
    // 5秒后自动重置状态
    setTimeout(() => {
        this.setData({
        connectionStatus: 'normal'
      });
    }, 5000);
  },
  
  /**
   * 启动自动刷新
   */
  startAutoRefresh: function() {
    // 清除可能存在的定时器
    this.clearAutoRefreshTimer();
    
    // 如果启用了自动刷新，则设置定时器
    if (this.data.autoRefreshEnabled) {
      this.autoRefreshTimer = setInterval(() => {
        console.log('执行自动刷新');
        this.loadAppointments(false);
      }, 180000); // 3分钟刷新一次
      
      console.log('自动刷新已启动');
    }
  },
  
  /**
   * 清除自动刷新定时器
   */
  clearAutoRefreshTimer: function() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
      console.log('自动刷新已停止');
    }
  },

  /**
   * 停止自动刷新 (兼容旧版本函数)
   */
  stopAutoRefresh: function() {
    console.log('调用了旧版本的stopAutoRefresh函数，将使用clearAutoRefreshTimer代替');
    this.clearAutoRefreshTimer();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function() {
    console.log('用户下拉刷新');
    this.loadAppointments(true);
    
    // 添加振动反馈
    if (wx.vibrateShort) {
      wx.vibrateShort();
    }
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function() {
    // 查看是否需要加载更多预约
    if (this.data.filteredAppointments.length >= MAX_LIMIT) {
      wx.showToast({
        title: '正在加载更多...',
        icon: 'loading',
        duration: 1000
      });
      
      // 这里可以实现分页加载更多的逻辑
      // 目前每次查询都是获取全部，所以这里暂不实现
      setTimeout(() => {
        wx.showToast({
          title: '已加载全部预约',
          icon: 'none'
        });
      }, 1000);
    }
  },
  
  /**
   * 刷新预约列表
   */
  refreshAppointments: function (silent = false) {
    this.setData({
      selectedFilter: 'all',
      searchQuery: '',
      filteredAppointments: []
    });
    
    // 添加振动反馈
    if (!silent && wx.vibrateShort) {
      wx.vibrateShort();
    }
    
    this.loadAppointments();
    
    if (!silent) {
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
      this.startAutoRefresh();
    }
  },

  // 添加新预约
  navigateToAddAppointment: function () {
    wx.navigateTo({
      url: '/pages/add-appointment/add-appointment'
    });
  },

  // 调试功能
  debugFunction: function () {
    wx.showActionSheet({
      itemList: ['打印当前预约数据', '打印员工登录状态', '检测云环境连接', '检查数据库预约'],
      success: res => {
        switch (res.tapIndex) {
          case 0:
            console.log('当前预约数据:', this.data.appointments);
            wx.showModal({
              title: '数据查看',
              content: `当前界面有 ${this.data.appointments.length} 条预约数据`,
              showCancel: false
            });
            break;
          case 1:
            const staffInfo = wx.getStorageSync('staffInfo') || {};
            const isStaffLoggedIn = wx.getStorageSync('isStaffLoggedIn') || false;
            console.log('员工登录状态:', isStaffLoggedIn);
            console.log('员工信息:', staffInfo);
            wx.showModal({
              title: '员工状态',
              content: `登录状态: ${isStaffLoggedIn ? '已登录' : '未登录'}\n员工ID: ${staffInfo._id || '无'}\n员工姓名: ${staffInfo.name || '无'}`,
              showCancel: false,
              success: () => {
                wx.setClipboardData({
                  data: JSON.stringify(staffInfo, null, 2),
                  success: () => {
                    wx.showToast({
                      title: '员工信息已复制',
                      icon: 'success'
                    });
                  }
                });
              }
            });
            break;
          case 2:
            wx.showLoading({
              title: '检查连接中...',
            });
            wx.cloud.callFunction({
              name: 'checkConnection',
              success: res => {
        wx.hideLoading();
                wx.showModal({
                  title: '连接状态',
                  content: `云环境连接正常，响应时间: ${res.result.responseTime}ms`,
                  showCancel: false
                });
              },
              fail: err => {
                wx.hideLoading();
                wx.showModal({
                  title: '连接状态',
                  content: '云环境连接失败，请检查网络',
                  showCancel: false
                });
                console.error('检查连接失败:', err);
              }
            });
            break;
          case 3:
            wx.showLoading({
              title: '检查数据库中...',
            });
            const staffId = wx.getStorageSync('staffInfo')?._id || '';
            
            if (!staffId) {
              wx.hideLoading();
        wx.showToast({
                title: '未找到员工ID',
          icon: 'none'
        });
              return;
            }
            
            console.log('使用员工ID检查数据库:', staffId);
            
            // 先直接查询数据库所有预约
            const db = wx.cloud.database();
            db.collection('appointments').count().then(res => {
              console.log('数据库中所有预约数量:', res.total);
              
              // 查询当前员工的预约
              return db.collection('appointments').where({
                staffId: staffId
              }).count();
            }).then(res => {
              console.log(`员工ID ${staffId} 的预约数量:`, res.total);
              
              // 查询示例预约
              if (res.total > 0) {
                return db.collection('appointments').where({
                  staffId: staffId
                }).limit(1).get();
              } else {
                return Promise.resolve({data: []});
              }
            }).then(res => {
              wx.hideLoading();
              
              if (res.data && res.data.length > 0) {
                console.log('预约示例:', res.data[0]);
                wx.showModal({
                  title: '数据库检查',
                  content: `找到员工预约记录，第一条预约ID: ${res.data[0]._id}`,
                  showCancel: false
                });
              } else {
                console.log('未找到员工预约记录');
                wx.showModal({
                  title: '数据库检查',
                  content: `未找到员工 ${staffId} 的预约记录，请检查员工ID是否正确`,
                  showCancel: false
                });
              }
            }).catch(err => {
              wx.hideLoading();
              console.error('查询数据库失败:', err);
              wx.showModal({
                title: '数据库检查',
                content: `查询失败: ${err.message || '未知错误'}`,
                showCancel: false
              });
            });
            break;
        }
      }
    });
  },

  // 查看已完成预约详情
  viewCompletedAppointmentDetails: function (e) {
    const index = e.currentTarget.dataset.index;
    const appointment = this.data.filteredAppointments[index];
    this.viewAppointmentDetail({
      currentTarget: {
        dataset: {
          appointment: appointment
        }
      }
    });
  },
  
  // 查看已取消预约详情
  viewCancelledAppointmentDetails: function (e) {
    const index = e.currentTarget.dataset.index;
    const appointment = this.data.filteredAppointments[index];
    this.viewAppointmentDetail({
      currentTarget: {
        dataset: {
          appointment: appointment
        }
      }
    });
  },
  
  // 开启静默调试模式
  enableSilentDebugMode: function() {
    // 仅在控制台显示，不影响用户体验
    this.setData({ debugMode: true });
    console.log('静默调试模式已开启，将自动执行诊断和错误检测功能');
  },

  /**
   * 跳转到日程页面
   */
  goToSchedule: function() {
    wx.navigateTo({
      url: '/pages/schedule/schedule',
      fail: (err) => {
        console.error('跳转到日程页失败:', err);
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
      }
    });
  },

  // 重新安排预约
  rescheduleAppointment: function(e) {
    const id = e.currentTarget.dataset.id;
    const appointment = this.data.appointments.find(item => item._id === id);
    
    if (!appointment) {
      wx.showToast({
        title: '找不到预约信息',
        icon: 'none'
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/edit-appointment/edit-appointment?id=${id}&mode=reschedule`,
      fail: (err) => {
        console.error('跳转到重排预约页失败:', err);
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 打印当前数据状态
   */
  logCurrentState: function() {
    console.log('======== 当前页面状态 ========');
    console.log('已登录状态:', this.data.isLoggedIn);
    console.log('员工信息:', this.data.staffInfo);
    console.log('当前选项卡:', this.data.activeTab);
    console.log('筛选状态:', this.data.selectedFilter);
    console.log('搜索关键词:', this.data.searchQuery);
    console.log('总预约数量:', this.data.appointments.length);
    console.log('筛选后预约数量:', this.data.filteredAppointments.length);
    console.log('统计信息:', this.data.stats);
    console.log('连接状态:', this.data.connectionStatus);
    console.log('======== 状态打印结束 ========');
  },
  
  /**
   * 修复页面显示问题
   */
  fixDisplayIssues: function() {
    // 尝试重新处理当前数据
    if (this.data.appointments && this.data.appointments.length > 0) {
      console.log('尝试修复显示问题，当前已有预约数据:', this.data.appointments.length);
      
      // 重新过滤预约
      const filtered = this.filterAppointments(this.data.appointments, this.data.searchQuery, this.data.selectedFilter);
      console.log('重新过滤结果:', filtered.length);
      
      // 更新视图
      this.setData({
        filteredAppointments: filtered,
        isLoading: false
      });
      
      return true;
    }
    
    return false;
  },
  
  /**
   * 检查页面完整性，防止显示异常
   */
  checkPageIntegrity: function() {
    // 直接调用自动诊断和状态日志
    this.logCurrentState();
    
    // 尝试修复显示问题
    if (!this.fixDisplayIssues()) {
      console.log('没有现有数据可以修复，尝试重新加载');
      // 如果没有数据，尝试重新加载
      if (this.data.isLoggedIn) {
        this.loadAppointments();
      }
    }
  },

  /**
   * 初始化页面数据，并开始加载
   */
  initializePage: function() {
    console.log('初始化页面数据');
    
    // 设置初始状态
    this.setData({
      isLoading: true,
      activeTab: 'all', // 默认显示所有预约
      selectedFilter: 'all',
      searchQuery: '',
      lastRefreshTime: this.formatTime(new Date())
    });
    
    // 检查登录状态并加载数据
    this.checkLoginStatus();
    
    if (this.data.isLoggedIn) {
      console.log('已登录，开始加载数据');
      this.loadAppointments();
    } else {
      console.log('未登录，显示登录提示');
      this.setData({
        isLoading: false
      });
    }
  },
});