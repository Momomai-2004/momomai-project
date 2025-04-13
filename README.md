# Chilling 按摩预约小程序

这是一个基于微信小程序平台开发的按摩预约系统。用户可以通过该小程序预约按摩服务，管理会员卡，查看服务记录等。

## 功能特点

- 用户登录与认证
  - 微信手机号快捷登录
  - 员工账号登录
  - 管理员账号登录

- 会员管理
  - 会员卡余额查询
  - 剩余次数查看
  - 服务记录查询
  - 充值功能

- 预约管理
  - 在线预约服务
  - 预约时间选择
  - 预约状态查看
  - 预约记录管理

- 员工功能
  - 预约单处理
  - 服务验证
  - 会员信息管理

- 管理员功能
  - 系统设置
  - 员工管理
  - 服务项目管理
  - 数据统计

## 技术栈

- 微信小程序原生开发
- 云开发
  - 云函数
  - 云数据库
  - 云存储
- 微信支付接口

## 项目结构

```
miniprogram/
├── app.js                 # 小程序入口文件
├── app.json              # 小程序公共配置
├── app.wxss             # 小程序公共样式
├── pages/               # 页面文件夹
│   ├── index/          # 首页
│   ├── login/          # 登录相关页面
│   ├── member/         # 会员中心
│   ├── booking/        # 预约服务
│   └── staff/          # 员工后台
├── components/         # 自定义组件
├── images/            # 图片资源
└── utils/            # 工具函数

cloudfunctions/        # 云函数
├── getPhoneNumber/   # 获取手机号
├── getWXContext/     # 获取用户上下文
├── login/           # 登录相关
└── ...              # 其他云函数
```

## 开发环境

- 微信开发者工具
- Node.js
- npm/yarn

## 本地开发

1. 克隆项目
```bash
git clone [仓库地址]
cd [项目目录]
```

2. 安装依赖
```bash
npm install
```

3. 使用微信开发者工具打开项目

4. 开发和调试
- 本地调试需要开通云开发功能
- 确保云开发环境配置正确

## 部署说明

1. 上传并部署云函数
```bash
npm run deploy:cloud
```

2. 上传小程序代码
- 使用微信开发者工具上传版本
- 在小程序管理后台发布

## 注意事项

- 请确保已经开通微信小程序的云开发功能
- 首次使用需要初始化数据库集合
- 请妥善保管云开发环境ID和密钥
- 上线前请仔细检查配置文件中的环境ID

## 维护者

- [你的名字] - [联系方式]

## 许可证

[许可证类型] - 查看 [LICENSE](LICENSE) 文件了解更多详情。

