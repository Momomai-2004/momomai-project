// // 初始化云开发
// wx.cloud.init({
//   env: 'chilling-4gdawl4ea811c0cd', // 替换为你的环境ID
//   traceUser: true // 是否在将用户访问记录到用户管理中，在控制台可见
// });


const db = wx.cloud.database();
const ordersCollection = db.collection('orders');
const _ = db.command; // 获取数据库操作符

Page({
  data: {
    orderList: [],
    loading: false,
    pageSize: 10,
    currentPage: 0,
    hasMore: true,
    selectedStatus: 'all', // all, pending, paid, completed, cancelled
    paymentTimeLimit: 10 * 60 * 1000, // 10分钟支付时限（毫秒）
    countdownTimers: {}, // 存储各订单倒计时
    activeCollection: null, // 记录成功的集合名称，下次直接使用
    fromBooking: false, // 记录是否是从预约页面跳转来的
  },
  
  onLoad: function(options) {
    // 初始化云开发
    wx.cloud.init({
      env: 'chilling-4gdawl4ea811c0cd', // 替换为你的环境ID
      traceUser: true // 是否在将用户访问记录到用户管理中，在控制台可见
    });
    
    // 检查是否是从预约页面跳转来的
    if (options && options.from === 'booking') {
      // 设置导航栏左上角返回按钮的处理
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: '#07c160'
      });
      
      // 记录是从预约页面来的
      this.setData({
        fromBooking: true
      });
    }
    
    this.loadOrders();
    
    // 加载完成后检查取消失败的订单
    this.checkCancelFailedOrders();
    
    // 自动连接云数据库检查订单
    setTimeout(() => {
      this.autoDebugFetchOrders();
    }, 1000);
  },

  onShow() {
    console.log('订单页面显示');
    
    // 刷新订单列表
    this.setData({
      orderList: [],
      currentPage: 0,
      hasMore: true
    }, () => {
      this.loadOrders();
    });
    
    // 设置定时器，定期检查订单状态
    this.startOrderStatusChecker();
    
    // 设置自动刷新定时器
    this.startAutoRefresh();
    
    // 设置左上角返回按钮处理
    if (this.data.fromBooking) {
      wx.showNavigationBarLoading();
      // 添加自定义返回按钮事件，返回到会员页面
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.setNavigationBarTitle({
          title: '预约成功'
        });
      }
      wx.hideNavigationBarLoading();
    }
  },

  onHide() {
    // 清除所有计时器
    this.clearAllCountdowns();
    
    // 清除状态检查定时器
    this.clearOrderStatusChecker();
    
    // 清除自动刷新定时器
    this.clearAutoRefresh();
  },

  onUnload() {
    // 清除所有计时器
    this.clearAllCountdowns();
    
    // 清除状态检查定时器
    this.clearOrderStatusChecker();
    
    // 清除自动刷新定时器
    this.clearAutoRefresh();
    
    // 如果是从预约页面跳转来的，点击返回按钮时跳转到会员页面
    if (this.data.fromBooking) {
      wx.switchTab({
        url: '/pages/member/member'
      });
    }
  },
  
  // 开始订单状态检查定时器
  startOrderStatusChecker() {
    // 清除已有的定时器
    this.clearOrderStatusChecker();
    
    // 每分钟检查一次订单状态
    const timerId = setInterval(() => {
      console.log('定时检查订单状态...');
      this.checkAllOrdersStatus();
    }, 60 * 1000); // 60秒检查一次
    
    this.orderStatusCheckerId = timerId;
  },
  
  // 清除订单状态检查定时器
  clearOrderStatusChecker() {
    if (this.orderStatusCheckerId) {
      clearInterval(this.orderStatusCheckerId);
      this.orderStatusCheckerId = null;
    }
  },
  
  // 检查所有订单状态
  checkAllOrdersStatus() {
    const orders = this.data.orderList;
    if (!orders || orders.length === 0) return;
    
    let hasStatusChanged = false;
    let pendingCancellations = [];
    
    // 检查所有订单
    orders.forEach(order => {
      // 检查待支付订单是否超时
      if (order.status === 'pending' && order.create_time && !order.autoCancel) {
        const createTime = new Date(order.create_time).getTime();
        const now = new Date().getTime();
        const elapsed = now - createTime;
        
        if (elapsed > this.data.paymentTimeLimit) {
          console.log(`定时检查：订单 ${order._id} 已超时，将被自动取消`);
          // 只标记状态变更，稍后统一处理
          order.status = 'cancelled';
          order.statusText = this.getStatusText('cancelled');
          order.autoCancel = true;
          order.remainingTime = '已超时';
          hasStatusChanged = true;
          
          // 添加到待取消列表
          pendingCancellations.push(order._id);
        }
      }
      
      // 检查已支付订单是否应该标记为已完成
      if (order.status === 'paid' && !order.auto_completed) {
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
            const now = new Date();
            
            // 如果当前时间超过了服务结束时间，自动标记为已完成
            if (now > serviceEndTime) {
              this.updateOrderStatus(order._id, 'completed', true);
              order.status = 'completed';
              order.statusText = this.getStatusText('completed');
              order.auto_completed = true;
              hasStatusChanged = true;
              
              console.log(`订单 ${order._id} 服务已结束，自动标记为已完成：`, 
                        `预约时间: ${appointmentDateTime.toLocaleString()}, ` +
                        `服务时长: ${serviceDuration}分钟, ` +
                        `结束时间: ${serviceEndTime.toLocaleString()}, ` +
                        `当前时间: ${now.toLocaleString()}`);
            } else {
              const remainingMs = serviceEndTime.getTime() - now.getTime();
              const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
              const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
              console.log(`订单 ${order._id} 服务尚未结束，剩余: ${remainingHours}小时${remainingMinutes}分钟`);
            }
          } else {
            console.warn(`订单 ${order._id} 缺少预约日期或时间信息`);
          }
        } catch (err) {
          console.error(`处理订单 ${order._id} 完成状态时出错:`, err);
        }
      }
    });
    
    // 统一处理需要取消的订单
    if (pendingCancellations.length > 0) {
      console.log(`将取消 ${pendingCancellations.length} 个超时订单`);
      setTimeout(() => {
        pendingCancellations.forEach(orderId => {
          this.cancelOrder(orderId, true);
        });
      }, 500);
    }
    
    // 如果有状态变更，更新UI
    if (hasStatusChanged) {
      this.setData({
        orderList: orders
      });
    }
  },
  
  // 清除所有倒计时
  clearAllCountdowns() {
    const timers = this.data.countdownTimers;
    for (const orderId in timers) {
      if (timers[orderId]) {
        clearInterval(timers[orderId]);
      }
    }
    this.setData({
      countdownTimers: {}
    });
  },
  
  // 加载订单数据
  loadOrders(callback) {
    if (!this.data.hasMore || this.data.loading) {
      console.log('订单页面显示', this.data.hasMore, '  ',  this.data.loading);
      if (callback) callback();
      return;
    }
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中...' });
    
    // 先获取理疗师数据
    this.fetchTherapists(() => {
      wx.cloud.callFunction({
        // 需调用的云函数名
        name: 'getuserorder',
        // 成功回调
        success: res => {
          console.log('订单数据成功：', res.result);
          if (res.result && res.result.openid) {
            let openId = res.result.openid;
            this.getOrdersFromDB(openId, callback);
          } else {
            wx.hideLoading();
            console.error('获取用户openid失败');
            wx.showToast({
              title: '获取用户信息失败',
              icon: 'none'
            });
            this.setData({ loading: false });
            if (callback) callback();
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('调用订单数据失败：', err);
          wx.showToast({
            title: '获取订单失败',
            icon: 'none'
          });
          this.setData({ loading: false });
          if (callback) callback();
        }
      });
    });
  },

  // 获取理疗师数据
  fetchTherapists(callback) {
    // 如果已经有理疗师数据，直接返回
    if (this.data.therapists && this.data.therapists.length > 0) {
      console.log('使用缓存的理疗师数据');
      if (callback) callback();
      return;
    }
    
    console.log('开始获取理疗师数据');
    wx.cloud.callFunction({
      name: 'fetchTherapists',
      success: res => {
        console.log('获取理疗师数据成功:', res);
        if (res.result && res.result.data) {
          this.setData({
            therapists: res.result.data
          });
          console.log(`已加载 ${res.result.data.length} 个理疗师数据`);
        } else {
          console.warn('获取理疗师数据成功但没有数据');
        }
        if (callback) callback();
      },
      fail: err => {
        console.error('获取理疗师数据失败:', err);
        // 失败也继续后续流程
        if (callback) callback();
      }
    });
  },

  getOrdersFromDB(openId, callback) {
    console.log('查询用户订单, openId:', openId);
    
    // 构建最基本的查询条件 - 只按openId查询，不添加任何过滤
    const queryCondition = {
      _openid: openId
    };
    
    console.log('简化查询条件:', JSON.stringify(queryCondition));
    
    // 尝试直接查询appointments集合
    wx.cloud.callFunction({
      name: 'checkDatabase',
      data: {
        collection: 'appointments',
        limit: 5
      },
      success: res => {
        console.log('检查appointments集合结果:', res.result);
        
        if (res.result && res.result.success) {
          console.log('appointments集合存在，尝试查询数据');
          this.debugQueryAppointments(queryCondition, callback);
        } else {
          console.warn('appointments集合不存在，尝试orders集合');
          this.debugQueryOrders(queryCondition, callback);
        }
      },
      fail: err => {
        console.error('检查集合失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '系统繁忙，请稍后再试',
          icon: 'none'
        });
        this.setData({ loading: false });
        if (callback) callback();
      }
    });
  },
  
  // 调试用 - 直接查询appointments集合
  debugQueryAppointments(queryCondition, callback) {
    const db = wx.cloud.database();
    
    console.log('直接查询appointments集合:', JSON.stringify(queryCondition));
    
    db.collection('appointments')
      .where(queryCondition)
      .orderBy('create_time', 'desc')
      .limit(20) // 增大查询数量，确保能获取到数据
      .get()
      .then(res => {
        const orders = res.data || [];
        console.log(`appointments集合查询结果: ${orders.length} 条数据`);
        
        if (orders.length > 0) {
          console.log('首条数据示例:', orders[0]);
          this.processOrders(orders, callback);
        } else {
          console.warn('appointments集合中未找到订单，尝试orders集合');
          this.debugQueryOrders(queryCondition, callback);
        }
      })
      .catch(err => {
        console.error('查询appointments集合失败:', err);
        this.debugQueryOrders(queryCondition, callback);
      });
  },
  
  // 调试用 - 直接查询orders集合
  debugQueryOrders(queryCondition, callback) {
    const db = wx.cloud.database();
    
    console.log('直接查询orders集合:', JSON.stringify(queryCondition));
    
    db.collection('orders')
      .where(queryCondition)
      .orderBy('create_time', 'desc')
      .limit(20) // 增大查询数量，确保能获取到数据
      .get()
      .then(res => {
        const orders = res.data || [];
        console.log(`orders集合查询结果: ${orders.length} 条数据`);
        
        if (orders.length > 0) {
          console.log('首条数据示例:', orders[0]);
          this.processOrders(orders, callback);
        } else {
          console.warn('orders集合中未找到订单，尝试bookings集合');
          this.debugQueryBookings(queryCondition, callback);
        }
      })
      .catch(err => {
        console.error('查询orders集合失败:', err);
        this.debugQueryBookings(queryCondition, callback);
      });
  },
  
  // 调试用 - 直接查询bookings集合
  debugQueryBookings(queryCondition, callback) {
    const db = wx.cloud.database();
    
    console.log('直接查询bookings集合:', JSON.stringify(queryCondition));
    
    db.collection('bookings')
      .where(queryCondition)
      .orderBy('create_time', 'desc')
      .limit(20) // 增大查询数量，确保能获取到数据
      .get()
      .then(res => {
        const orders = res.data || [];
        console.log(`bookings集合查询结果: ${orders.length} 条数据`);
        
        if (orders.length > 0) {
          console.log('首条数据示例:', orders[0]);
          this.processOrders(orders, callback);
        } else {
          console.warn('bookings集合中未找到订单，尝试reservations集合');
          this.debugQueryReservations(queryCondition, callback);
        }
      })
      .catch(err => {
        console.error('查询bookings集合失败:', err);
        this.debugQueryReservations(queryCondition, callback);
      });
  },
  
  // 调试用 - 直接查询reservations集合
  debugQueryReservations(queryCondition, callback) {
    const db = wx.cloud.database();
    
    console.log('直接查询reservations集合:', JSON.stringify(queryCondition));
    
    db.collection('reservations')
      .where(queryCondition)
      .orderBy('create_time', 'desc')
      .limit(20) // 增大查询数量，确保能获取到数据
      .get()
      .then(res => {
        const orders = res.data || [];
        console.log(`reservations集合查询结果: ${orders.length} 条数据`);
        
        if (orders.length > 0) {
          console.log('首条数据示例:', orders[0]);
          this.processOrders(orders, callback);
        } else {
          console.warn('所有集合都查询完毕，未找到订单数据');
          this.handleNoOrders(callback);
        }
      })
      .catch(err => {
        console.error('查询reservations集合失败:', err);
        this.handleNoOrders(callback);
      });
  },
  
  // 处理未找到订单的情况
  handleNoOrders(callback) {
    wx.hideLoading();
    console.warn('所有集合都查询完毕，未找到用户订单数据');
    
    // 尝试创建测试订单（仅在开发环境使用）
    console.log('考虑是否创建测试订单');
    
    // 用户友好提示
    wx.showToast({
      title: '暂无订单数据',
      icon: 'none',
      duration: 2000
    });
    
    this.setData({ 
      loading: false,
      orderList: [] // 确保设置为空数组
    });
    
    if (callback) callback();
  },
  
  // 处理查询到的订单数据
  processOrders(orders, callback) {
    console.log(`处理 ${orders.length} 条订单数据`);
    
    // 根据状态过滤
    let filteredOrders = orders;
    if (this.data.selectedStatus === 'paid') {
      filteredOrders = orders.filter(order => 
        order.status === 'paid' || 
        (order.payment_method && ['wechat', 'wallet', 'times'].includes(order.payment_method))
      );
    } else if (this.data.selectedStatus === 'pending') {
      filteredOrders = orders.filter(order => order.status === 'pending');
    } else if (this.data.selectedStatus === 'cancelled') {
      filteredOrders = orders.filter(order => order.status === 'cancelled');
    } else if (this.data.selectedStatus === 'all') {
      // 在"全部"标签下不显示已完成的订单，因为已完成订单在历史页面显示
      filteredOrders = orders.filter(order => order.status !== 'completed');
    }
    
    console.log(`过滤后剩余 ${filteredOrders.length} 条订单`);
    
    // 清除旧的倒计时
    this.clearAllCountdowns();
    
    // 格式化订单数据
    const formattedOrders = filteredOrders.map(order => {
      // 添加理疗师信息
      let therapistInfo = null;
      if (order.therapist_id && this.data.therapists) {
        therapistInfo = this.data.therapists.find(t => t._id === order.therapist_id);
      }
      
      // 检查倒计时
      if (order.status === 'pending' && order.create_time) {
        const createTime = new Date(order.create_time).getTime();
        const now = new Date().getTime();
        const elapsed = now - createTime;
        
        if (elapsed > this.data.paymentTimeLimit) {
          order.status = 'cancelled';
          order.autoCancel = true;
        } else {
          this.setOrderCountdown(order._id, createTime);
        }
      }
      
      return {
        ...order,
        createTimeFormat: this.formatDate(order.create_time),
        amountFormat: (order.price || 0).toFixed(2),
        statusText: this.getStatusText(order.status || 'pending'),
        paymentMethodText: this.getPaymentMethodText(order.payment_method || 'unknown'),
        remainingTime: this.calculateRemainingTime(order),
        therapistName: therapistInfo ? therapistInfo.name : (order.therapistName || order.therapist_name || ''),
        therapistTitle: therapistInfo ? therapistInfo.title : (order.therapistTitle || order.therapist_title || ''),
        therapistAvatar: therapistInfo ? therapistInfo.avatar : (order.therapistAvatar || order.therapist_avatar || '')
      };
    });
    
    // 记录成功的集合名称
    this.setData({
      orderList: formattedOrders,
      currentPage: 1,
      hasMore: false, // 简化版查询不支持分页
      loading: false
    });
    
    wx.hideLoading();
    
    if (callback) callback();
  },
  
  // 计算订单剩余支付时间
  calculateRemainingTime(order) {
    if (order.status !== 'pending' || !order.create_time) {
      return '';
    }
    
    const createTime = new Date(order.create_time).getTime();
    const now = new Date().getTime();
    const elapsed = now - createTime;
    const remaining = this.data.paymentTimeLimit - elapsed;
    
    if (remaining <= 0) {
      return '已超时';
    }
    
    // 转换为分:秒格式
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  },
  
  // 设置订单倒计时
  setOrderCountdown(orderId, createTime) {
    // 清除已有的计时器
    if (this.data.countdownTimers[orderId]) {
      clearInterval(this.data.countdownTimers[orderId]);
    }
    
    // 设置新的计时器
    const timerId = setInterval(() => {
      const now = new Date().getTime();
      const elapsed = now - createTime;
      const remaining = this.data.paymentTimeLimit - elapsed;
      
      if (remaining <= 0) {
        // 清除计时器
        clearInterval(timerId);
        
        // 更新计时器状态
        const timers = this.data.countdownTimers;
        delete timers[orderId];
        this.setData({
          countdownTimers: timers
        });
        
        // 更新UI状态 - 标记为已取消但暂不调用云函数
        const orders = this.data.orderList;
        let targetOrder = null;
        
        for (let i = 0; i < orders.length; i++) {
          if (orders[i]._id === orderId) {
            // 仅处理"pending"状态的订单，避免重复取消
            if (orders[i].status === 'pending') {
              orders[i].status = 'cancelled';
              orders[i].statusText = this.getStatusText('cancelled');
              orders[i].autoCancel = true;
              orders[i].remainingTime = '已超时';
              targetOrder = orders[i];
            }
            break;
          }
        }
        
        this.setData({
          orderList: orders
        });
        
        // 如果找到了需要取消的订单，调用云函数取消
        if (targetOrder && targetOrder.status === 'cancelled') {
          console.log(`倒计时结束：订单 ${orderId} 已超时，将被自动取消`);
          // 延迟调用云函数，避免影响UI更新
          setTimeout(() => {
            this.cancelOrder(orderId, true);
          }, 500);
        }
        
        return;
      }
      
      // 更新UI显示的倒计时
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      const remainingTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      
      const orders = this.data.orderList;
      for (let i = 0; i < orders.length; i++) {
        if (orders[i]._id === orderId) {
          orders[i].remainingTime = remainingTime;
          break;
        }
      }
      this.setData({
        orderList: orders
      });
    }, 1000);
    
    // 保存计时器ID
    const timers = this.data.countdownTimers;
    timers[orderId] = timerId;
    this.setData({
      countdownTimers: timers
    });
  },
  
  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待支付',
      'paid': '已支付',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || status;
  },
  
  // 下拉刷新
  onPullDownRefresh() {
    console.log('用户下拉刷新');
    this.setData({
      orderList: [],
      currentPage: 0,
      hasMore: true
    }, () => {
      this.loadOrders(() => {
        // 停止下拉刷新动画
        wx.stopPullDownRefresh();
      });
    });
  },
  
  // 上拉加载更多
  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadOrders();
    }
  },
  
  // 筛选订单状态
  filterByStatus: function(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      selectedStatus: status,
      orderList: [],
      currentPage: 0,
      hasMore: true
    }, () => {
      this.loadOrders();
    });
  },
  
  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  },
  
  // 查看订单详情或操作
  viewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    const orderStatus = e.currentTarget.dataset.status;
    const action = e.currentTarget.dataset.action;
    
    // 根据不同操作处理
    if (action === 'pay') {
      // 去支付
      this.goToPay(orderId);
      return;
    } else if (action === 'cancel') {
      // 取消订单
      wx.showModal({
        title: '提示',
        content: '确定要取消该订单吗？',
        success: (res) => {
          if (res.confirm) {
            this.cancelOrder(orderId);
          }
        }
      });
      return;
    }
    
    // 查看详情
    let content = '订单详情信息';
    
    // 找到当前订单
    const order = this.data.orderList.find(item => item._id === orderId);
    if (order) {
      // 基本订单信息
      content = `服务：${order.service_name}\n时长：${order.service_duration}分钟\n预约时间：${order.appointment_date} ${order.time_slot}\n价格：￥${order.amountFormat}\n状态：${order.statusText}`;
      
      // 添加理疗师信息
      if (order.therapistName) {
        content += `\n理疗师：${order.therapistName}`;
        if (order.therapistTitle) {
          content += ` (${order.therapistTitle})`;
        }
      }
      
      // 如果是已支付订单，显示支付方式
      if (order.status === 'paid' && order.payment_method) {
        content += `\n支付方式：${this.getPaymentMethodText(order.payment_method)}`;
        
        // 如果有支付时间，也显示
        if (order.pay_time) {
          const payTime = this.formatDate(order.pay_time);
          content += `\n支付时间：${payTime}`;
        }
      }
    }
    
    wx.showModal({
      title: '订单详情',
      content: content,
      showCancel: false
    });
  },
  
  // 获取支付方式文本
  getPaymentMethodText(paymentMethod) {
    const methodMap = {
      'wechat': '微信支付',
      'cash': '现金支付',
      'card': '银行卡',
      'times': '次卡支付',
      'free': '免费服务',
      'alipay': '支付宝'
    };
    return methodMap[paymentMethod] || '未知方式';
  },
  
  // 去支付
  goToPay(orderId) {
    // 找到当前订单
    const order = this.data.orderList.find(item => item._id === orderId);
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否已超时
    if (order.status === 'pending') {
      const createTime = new Date(order.create_time).getTime();
      const now = new Date().getTime();
      const elapsed = now - createTime;
      
      if (elapsed > this.data.paymentTimeLimit) {
        wx.showToast({
          title: '订单已超时，请重新预约',
          icon: 'none'
        });
        
        // 自动取消超时订单
        this.cancelOrder(orderId, true);
        return;
      }
      
      // 调用支付接口
      wx.showLoading({ title: '发起支付...' });
      
      // 调用pay云函数处理支付
      wx.cloud.callFunction({
        name: 'pay',
        data: {
          amount: order.price,
          type: 'appointment',
          appointmentId: orderId,
          appointmentInfo: {
            service_id: order.service_id,
            service_name: order.service_name,
            appointment_date: order.appointment_date,
            time_slot: order.time_slot,
            service_duration: order.service_duration
          }
        }
      })
      .then(res => {
        wx.hideLoading();
        if (res.result && res.result.success && res.result.payment) {
          // 调用微信支付
          wx.requestPayment({
            ...res.result.payment,
            success: () => {
              // 支付成功，更新订单状态
              this.updateOrderStatus(orderId, 'paid');
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
    } else {
      wx.showToast({
        title: '订单状态已变更，请刷新',
        icon: 'none'
      });
    }
  },
  
  // 更新订单状态
  updateOrderStatus(orderId, status, isAuto = false) {
    // 非自动操作时显示加载提示
    if (!isAuto) {
      wx.showLoading({ title: '更新状态...' });
    }
    
    // 使用云函数更新状态
    wx.cloud.callFunction({
      name: 'updateAppointmentStatus',
      data: {
        appointmentId: orderId,
        status: status,
        autoComplete: status === 'completed' && isAuto
      }
    })
    .then(res => {
      if (!isAuto) {
        wx.hideLoading();
      }
      
      if (res.result && res.result.success) {
        if (!isAuto) {
          wx.showToast({
            title: this.getStatusUpdateText(status),
            icon: 'success'
          });
          
          // 刷新订单列表
          this.setData({
            orderList: [],
            currentPage: 0,
            hasMore: true
          }, () => {
            this.loadOrders();
          });
        } else {
          console.log(`订单 ${orderId} 已自动更新为 ${status}`);
          
          // 更新UI状态
          if (status === 'completed') {
            const orders = this.data.orderList;
            for (let i = 0; i < orders.length; i++) {
              if (orders[i]._id === orderId) {
                orders[i].status = 'completed';
                orders[i].statusText = this.getStatusText('completed');
                orders[i].auto_completed = true;
                break;
              }
            }
            this.setData({
              orderList: orders
            });
          }
        }
      } else {
        console.error('更新订单状态失败:', res.result);
        if (!isAuto) {
          wx.showToast({
            title: res.result.errMsg || '状态更新失败',
            icon: 'none'
          });
        }
      }
    })
    .catch(err => {
      console.error('调用云函数失败:', err);
      if (!isAuto) {
        wx.hideLoading();
        wx.showToast({
          title: '状态更新失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 获取状态更新的提示文本
  getStatusUpdateText(status) {
    switch (status) {
      case 'paid': return '支付成功';
      case 'completed': return '订单已完成';
      case 'cancelled': return '订单已取消';
      default: return '状态已更新';
    }
  },
  
  // 取消订单
  cancelOrder(orderId, isAuto = false, retryCount = 0) {
    const MAX_RETRIES = 3; // 最大重试次数
    
    if (!isAuto) {
      wx.showLoading({ title: '取消中...' });
    }
    
    // 记录调用情况
    console.log(`${isAuto ? '自动' : '手动'}取消订单 ${orderId}${retryCount > 0 ? ' (重试:' + retryCount + ')' : ''}`);
    
    // 使用云函数取消订单
    wx.cloud.callFunction({
      name: 'updateAppointmentStatus',
      data: {
        appointmentId: orderId,
        status: 'cancelled',
        reason: isAuto ? '支付超时自动取消' : '用户主动取消',
        autoComplete: isAuto
      }
    })
    .then(res => {
      if (!isAuto) {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          wx.showToast({
            title: '订单已取消',
            icon: 'success'
          });
          
          // 刷新订单列表
          this.setData({
            orderList: [],
            currentPage: 0,
            hasMore: true
          }, () => {
            this.loadOrders();
          });
        } else {
          console.error('取消订单失败:', res.result);
          wx.showToast({
            title: res.result && res.result.errMsg ? res.result.errMsg : '取消失败',
            icon: 'none'
          });
        }
      } else {
        console.log('订单已自动取消:', orderId);
      }
    })
    .catch(err => {
      console.error(`取消订单失败 (${retryCount}/${MAX_RETRIES}):`, err);
      
      if (!isAuto) {
        wx.hideLoading();
        wx.showToast({
          title: '取消失败',
          icon: 'none'
        });
      } else if (retryCount < MAX_RETRIES) {
        // 自动取消且未超过最大重试次数，延迟后重试
        console.log(`将在 ${(retryCount + 1) * 2} 秒后重试...`);
        setTimeout(() => {
          this.cancelOrder(orderId, isAuto, retryCount + 1);
        }, (retryCount + 1) * 2000); // 递增重试延迟
      } else {
        console.error(`已达最大重试次数，无法自动取消订单 ${orderId}`);
        // 标记本地状态为取消失败
        const orders = this.data.orderList;
        for (let i = 0; i < orders.length; i++) {
          if (orders[i]._id === orderId && orders[i].autoCancel) {
            orders[i].cancelFailed = true;
            break;
          }
        }
        this.setData({
          orderList: orders
        });
        
        // 保存到本地存储，防止刷新页面后状态丢失
        const cancelFailedOrders = wx.getStorageSync('cancelFailedOrders') || [];
        if (!cancelFailedOrders.includes(orderId)) {
          cancelFailedOrders.push(orderId);
          wx.setStorageSync('cancelFailedOrders', cancelFailedOrders);
        }
      }
    });
  },
  
  /**
   * 标记订单取消失败
   */
  markOrderCancelFailed: function(orderId) {
    const orderList = this.data.orderList;
    const index = orderList.findIndex(item => item._id === orderId);
    
    if (index !== -1) {
      // 更新订单状态
      orderList[index].cancelFailed = true;
      this.setData({
        orderList: orderList
      });
      
      // 保存到本地存储，防止刷新页面后状态丢失
      const cancelFailedOrders = wx.getStorageSync('cancelFailedOrders') || [];
      if (!cancelFailedOrders.includes(orderId)) {
        cancelFailedOrders.push(orderId);
        wx.setStorageSync('cancelFailedOrders', cancelFailedOrders);
      }
    }
  },
  
  /**
   * 检查本地存储中取消失败的订单
   */
  checkCancelFailedOrders: function() {
    const cancelFailedOrders = wx.getStorageSync('cancelFailedOrders') || [];
    if (cancelFailedOrders.length > 0) {
      const orderList = this.data.orderList;
      
      let updated = false;
      cancelFailedOrders.forEach(orderId => {
        const index = orderList.findIndex(item => item._id === orderId);
        if (index !== -1) {
          orderList[index].cancelFailed = true;
          updated = true;
        }
      });
      
      if (updated) {
        this.setData({
          orderList: orderList
        });
      }
    }
  },

  // 跳转到历史订单页面
  gotoHistory() {
    wx.navigateTo({
      url: '/pages/history/history',
    });
  },
  
  // 自动连接云数据库并查询订单（无需按钮点击）
  autoDebugFetchOrders: function() {
    console.log('自动连接云数据库...');
    
    // 使用云函数获取当前用户的openid
    wx.cloud.callFunction({
      name: 'getuserorder',
      success: res => {
        if (res.result && res.result.openid) {
          const openId = res.result.openid;
          console.log('获取用户openid成功:', openId);
          
          // 先安全检查数据库中存在哪些集合
          this.checkExistingCollections(openId);
        } else {
          console.error('获取用户openid失败');
        }
      },
      fail: err => {
        console.error('调用云函数失败:', err);
      }
    });
  },
  
  // 检查数据库中存在的集合
  checkExistingCollections: function(openId) {
    // 使用管理端API获取所有集合列表
    const db = wx.cloud.database();
    
    // 尝试先查询appointments
    this.trySafeQuery('appointments', openId, hasData => {
      if (!hasData) {
        // appointments集合没有数据或不存在，尝试查询orders
        this.trySafeQuery('orders', openId, hasOrdersData => {
          if (!hasOrdersData) {
            // 两个集合都没有数据，可能是用户没有订单
            console.log('未找到任何订单数据');
            // 用户可能还没有下过订单，显示友好提示
            wx.showToast({
              title: '暂无订单记录',
              icon: 'none',
              duration: 2000
            });
          }
        });
      }
    });
  },
  
  // 安全查询集合（避免集合不存在的错误）
  trySafeQuery: function(collectionName, openId, callback) {
    console.log(`尝试安全查询 ${collectionName} 集合...`);
    const db = wx.cloud.database();
    
    // 先用exists操作符检查集合是否存在
    wx.cloud.callFunction({
      name: 'checkCollection',
      data: {
        collection: collectionName
      },
      success: res => {
        const exists = res.result && res.result.exists;
        console.log(`集合 ${collectionName} ${exists ? '存在' : '不存在'}`);
        
        if (exists) {
          // 集合存在，执行查询
          db.collection(collectionName)
            .where({ _openid: openId })
            .limit(10)
            .get()
            .then(result => {
              const orders = result.data || [];
              console.log(`在 ${collectionName} 中找到 ${orders.length} 条订单`);
              
              if (orders.length > 0) {
                // 格式化处理订单数据
                const formattedOrders = orders.map(order => {
                  return {
                    ...order,
                    createTimeFormat: this.formatDate(order.create_time),
                    amountFormat: (order.price || 0).toFixed(2),
                    statusText: this.getStatusText(order.status || 'pending'),
                    paymentMethodText: this.getPaymentMethodText(order.payment_method || 'unknown')
                  };
                });
                
                // 根据状态筛选
                let filteredOrders = formattedOrders;
                if (this.data.selectedStatus === 'paid') {
                  filteredOrders = formattedOrders.filter(order => 
                    order.status === 'paid' || 
                    (order.payment_method && ['wechat', 'wallet', 'times'].includes(order.payment_method))
                  );
                } else if (this.data.selectedStatus !== 'all') {
                  filteredOrders = formattedOrders.filter(order => order.status === this.data.selectedStatus);
                }
                
                if (filteredOrders.length > 0) {
                  this.setData({
                    orderList: filteredOrders,
                    activeCollection: collectionName
                  });
                  
                  console.log(`已加载 ${filteredOrders.length} 条订单数据`);
                  callback(true);
                  return;
                }
              }
              callback(false);
            })
            .catch(err => {
              console.error(`查询 ${collectionName} 出错:`, err);
              callback(false);
            });
        } else {
          // 集合不存在，直接返回
          callback(false);
        }
      },
      fail: err => {
        console.error('检查集合是否存在失败:', err);
        // 如果检查失败，尝试直接查询（可能会失败，但捕获错误）
        try {
          db.collection(collectionName)
            .limit(1)
            .get()
            .then(() => {
              // 如果成功，说明集合存在
              this.trySafeQuery(collectionName, openId, callback);
            })
            .catch(() => {
              // 集合可能不存在或其他错误
              callback(false);
            });
        } catch (e) {
          console.error('尝试查询失败:', e);
          callback(false);
        }
      }
    });
  },
  
  // 补零函数
  padZero(num) {
    return num < 10 ? '0' + num : num;
  },
  
  // 刷新订单数据
  refreshOrders() {
    wx.showLoading({ title: '刷新中...' });
    
    // 重置查询状态
    this.setData({
      orderList: [],
      currentPage: 0,
      hasMore: true,
      activeCollection: null
    }, () => {
      this.loadOrders(() => {
        wx.hideLoading();
        wx.showToast({
          title: '已刷新',
          icon: 'success'
        });
      });
    });
  },

  // 开始自动刷新定时器
  startAutoRefresh() {
    // 清除已有的定时器
    this.clearAutoRefresh();
    
    // 设置30秒自动刷新一次
    this.autoRefreshTimer = setInterval(() => {
      console.log('自动刷新订单数据...');
      if (this.data.orderList.length === 0) {
        // 如果当前没有数据，刷新
        this.setData({
          currentPage: 0,
          hasMore: true
        }, () => {
          this.loadOrders();
        });
      }
    }, 30000); // 30秒刷新一次
  },

  // 清除自动刷新定时器
  clearAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  },

  // 处理返回会员页面
  navigateToMember() {
    wx.switchTab({
      url: '/pages/member/member'
    });
  },
  
  // 处理返回按钮事件
  onBackPress() {
    if (this.data.fromBooking) {
      this.navigateToMember();
      return true; // 返回true表示已处理返回事件
    }
    return false; // 返回false表示不处理，走默认的返回逻辑
  },
}); 