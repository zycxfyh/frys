# frys 领域驱动设计层 (src/domain/)

## 📖 模块概述

frys 的领域层采用了领域驱动设计 (Domain-Driven Design, DDD) 的核心理念，通过实体、值对象、领域服务、仓储等模式实现业务领域的建模。该层确保了业务逻辑的纯净性，与基础设施层的完全解耦。

### 🎯 核心特性

- **领域实体建模** - 完整的业务实体和值对象
- **业务规则封装** - 领域逻辑的集中管理
- **聚合根设计** - 一致性边界的明确定义
- **领域事件** - 业务事件的发布和处理
- **仓储模式** - 数据访问的抽象接口

### 🏗️ 领域架构

```
领域驱动设计层 (src/domain/)
├── 📋 实体 (Entities)
│   ├── 用户实体 (auth/User.js)
│   ├── 角色实体 (auth/Role.js)
│   ├── 令牌实体 (Token)
│   └── 工作流实体 (Workflow)
├── 💎 值对象 (Value Objects)
│   ├── 用户名 (Username)
│   ├── 邮箱 (Email)
│   ├── 密码哈希 (PasswordHash)
│   └── 权限 (Permission)
├── 🏢 聚合根 (Aggregate Roots)
│   ├── 用户聚合 (UserAggregate)
│   ├── 工作流聚合 (WorkflowAggregate)
│   └── 认证聚合 (AuthAggregate)
├── 🔧 领域服务 (Domain Services)
│   ├── 用户领域服务 (UserDomainService)
│   ├── 认证领域服务 (AuthDomainService)
│   └── 工作流领域服务 (WorkflowDomainService)
├── 📚 仓储接口 (Repository Interfaces)
│   ├── 用户仓储 (UserRepository)
│   ├── 角色仓储 (RoleRepository)
│   ├── 令牌仓储 (TokenRepository)
│   └── 工作流仓储 (WorkflowRepository)
├── 📢 领域事件 (Domain Events)
│   ├── 用户创建事件 (UserCreatedEvent)
│   ├── 用户登录事件 (UserLoggedInEvent)
│   └── 工作流执行事件 (WorkflowExecutedEvent)
└── 📋 规范接口 (Specification Interfaces)
    ├── 用户规范 (UserSpecification)
    └── 工作流规范 (WorkflowSpecification)
```

## 📋 实体 (Entities)

### 用户实体 (User)

用户实体是系统中的核心业务对象，封装了用户的状态和行为。

```javascript
import { User, Username, Email } from 'frys-domain';

// 创建用户实体
const username = new Username('john_doe');
const email = new Email('john@example.com');

const user = new User({
  id: 'user-123',
  username: username.value,
  email: email.value,
  passwordHash: await hashPassword('securePassword'),
  roles: ['user'],
  permissions: ['read:profile', 'write:profile'],
  profile: {
    firstName: 'John',
    lastName: 'Doe',
    avatar: 'https://example.com/avatar.jpg',
  },
});

// 用户行为
user.updateLastLogin(); // 更新最后登录时间
user.verifyEmail(); // 验证邮箱
user.assignRole('admin'); // 分配角色
user.assignPermission('admin:*'); // 分配权限

// 检查权限（支持通配符）
if (user.hasPermissionWildcard('admin:users')) {
  // 执行管理员操作
}

// 转换为数据传输对象
const userDTO = user.toDTO();
const publicDTO = user.toPublicDTO();
```

### 用户实体属性

```javascript
class User extends BaseEntity {
  constructor(props) {
    // 基础属性
    this.id; // 唯一标识符
    this.createdAt; // 创建时间
    this.updatedAt; // 更新时间

    // 业务属性
    this.username; // 用户名
    this.email; // 邮箱地址
    this.passwordHash; // 密码哈希
    this.isActive; // 是否激活
    this.isEmailVerified; // 邮箱是否验证
    this.roles; // 角色列表
    this.permissions; // 权限列表
    this.profile; // 用户资料
    this.lastLoginAt; // 最后登录时间
  }
}
```

### 角色实体 (Role)

角色实体定义了用户的权限集合和职责分组。

```javascript
import { Role } from 'frys-domain';

const adminRole = new Role({
  id: 'role-admin',
  name: 'Administrator',
  description: '系统管理员，具有所有权限',
  permissions: [
    'user:*', // 用户管理所有权限
    'role:*', // 角色管理所有权限
    'system:*', // 系统管理所有权限
  ],
  isSystemRole: true, // 系统内置角色
  createdBy: 'system',
});

const editorRole = new Role({
  id: 'role-editor',
  name: 'Editor',
  description: '内容编辑员',
  permissions: ['content:create', 'content:edit', 'content:publish'],
  parentRoles: ['role-user'], // 继承用户角色
});

// 角色层级检查
if (editorRole.inheritsFrom('role-user')) {
  // 编辑角色继承了用户角色的权限
}

// 获取所有权限（包括继承的）
const allPermissions = editorRole.getAllPermissions();
```

### 令牌实体 (Token)

令牌实体管理用户的访问令牌和会话。

```javascript
import { Token } from 'frys-domain';

const accessToken = new Token({
  id: 'token-123',
  userId: 'user-123',
  type: 'access',
  tokenValue: generateSecureToken(),
  expiresAt: new Date(Date.now() + 3600000), // 1小时后过期
  issuedAt: new Date(),
  metadata: {
    userAgent: 'Mozilla/5.0...',
    ipAddress: '192.168.1.1',
  },
});

// 令牌验证
if (accessToken.isExpired()) {
  throw new Error('令牌已过期');
}

if (!accessToken.isValidForUser('user-123')) {
  throw new Error('令牌无效');
}

// 令牌撤销
accessToken.revoke();
```

## 💎 值对象 (Value Objects)

### 用户名值对象 (Username)

```javascript
class Username extends BaseValueObject {
  constructor(value) {
    super({ value });
    this.validate();
  }

  validate() {
    if (!this.value || typeof this.value !== 'string') {
      throw new Error('用户名是必需的且必须是字符串');
    }
    if (this.value.length < 3 || this.value.length > 50) {
      throw new Error('用户名长度必须在3-50个字符之间');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(this.value)) {
      throw new Error('用户名只能包含字母、数字、下划线和连字符');
    }
  }

  // 值对象是不可变的
  // 任何修改都返回新的实例
  changeTo(newUsername) {
    return new Username(newUsername);
  }

  // 值相等性比较
  equals(other) {
    return other instanceof Username && this.value === other.value;
  }
}
```

### 邮箱值对象 (Email)

```javascript
class Email extends BaseValueObject {
  constructor(value) {
    super({ value });
    this.validate();
  }

  validate() {
    if (!this.value || typeof this.value !== 'string') {
      throw new Error('邮箱是必需的且必须是字符串');
    }
    if (!this.isValidFormat()) {
      throw new Error('邮箱格式无效');
    }
  }

  isValidFormat() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(this.value);
  }

  get domain() {
    return this.value.split('@')[1];
  }

  get localPart() {
    return this.value.split('@')[0];
  }

  // 检查是否是企业邮箱
  isBusinessEmail() {
    const businessDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
    return !businessDomains.includes(this.domain);
  }
}
```

### 权限值对象 (Permission)

```javascript
class Permission extends BaseValueObject {
  constructor(value) {
    super({ value });
    this.validate();
  }

  validate() {
    if (!this.value || typeof this.value !== 'string') {
      throw new Error('权限字符串是必需的');
    }
    if (!this.isValidFormat()) {
      throw new Error(
        '权限格式无效，应为 resource:action 或 resource:action:scope',
      );
    }
  }

  isValidFormat() {
    const parts = this.value.split(':');
    return parts.length >= 2 && parts.length <= 3;
  }

  get resource() {
    return this.value.split(':')[0];
  }

  get action() {
    return this.value.split(':')[1];
  }

  get scope() {
    const parts = this.value.split(':');
    return parts.length === 3 ? parts[2] : null;
  }

  // 检查权限匹配（支持通配符）
  matches(requiredPermission) {
    if (this.value === '*' || this.value === requiredPermission.value) {
      return true;
    }

    const thisParts = this.value.split(':');
    const reqParts = requiredPermission.value.split(':');

    if (thisParts.length !== reqParts.length) {
      return false;
    }

    for (let i = 0; i < thisParts.length; i++) {
      if (thisParts[i] !== '*' && thisParts[i] !== reqParts[i]) {
        return false;
      }
    }

    return true;
  }
}
```

## 🏢 聚合根 (Aggregate Roots)

### 用户聚合根 (UserAggregate)

```javascript
class UserAggregate extends BaseAggregate {
  constructor(user, roles = [], permissions = []) {
    super();
    this.user = user;
    this.roles = roles;
    this.permissions = permissions;
  }

  // 业务方法 - 确保聚合内的一致性
  async changePassword(newPasswordHash) {
    // 验证密码强度
    if (!this.isValidPassword(newPasswordHash)) {
      throw new DomainError('密码不符合要求');
    }

    // 更新密码
    this.user.passwordHash = newPasswordHash;
    this.user.updatedAt = new Date();

    // 发布领域事件
    this.addDomainEvent(new UserPasswordChangedEvent(this.user.id));
  }

  async assignRole(roleId) {
    // 检查角色是否存在
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new DomainError('角色不存在');
    }

    // 检查权限冲突
    if (this.hasConflictingPermissions(role.permissions)) {
      throw new DomainError('权限冲突，无法分配角色');
    }

    // 分配角色
    this.user.assignRole(roleId);
    this.roles.push(role);

    // 发布事件
    this.addDomainEvent(new UserRoleAssignedEvent(this.user.id, roleId));
  }

  // 获取用户的所有权限（包括角色权限）
  getAllPermissions() {
    const userPermissions = this.user.permissions;
    const rolePermissions = this.roles.flatMap((role) => role.permissions);

    return [...new Set([...userPermissions, ...rolePermissions])];
  }

  // 权限冲突检查
  hasConflictingPermissions(newPermissions) {
    const allPermissions = this.getAllPermissions();

    // 检查互斥权限
    const exclusivePermissions = [
      ['admin:*', 'guest:*'],
      ['write:*', 'read-only:*'],
    ];

    for (const [perm1, perm2] of exclusivePermissions) {
      if (
        this.hasPermission(allPermissions, perm1) &&
        this.hasPermission(newPermissions, perm2)
      ) {
        return true;
      }
    }

    return false;
  }
}
```

### 认证聚合根 (AuthAggregate)

```javascript
class AuthAggregate extends BaseAggregate {
  constructor(user, activeTokens = []) {
    super();
    this.user = user;
    this.activeTokens = activeTokens;
  }

  async authenticate(credentials) {
    // 验证用户状态
    if (!this.user.isActive) {
      throw new DomainError('用户已被停用');
    }

    if (!this.user.isEmailVerified) {
      throw new DomainError('邮箱未验证');
    }

    // 验证密码
    const isValidPassword = await this.verifyPassword(credentials.password);
    if (!isValidPassword) {
      this.recordFailedAttempt();
      throw new DomainError('密码错误');
    }

    // 生成令牌
    const tokens = await this.generateTokens();

    // 记录登录
    this.user.updateLastLogin();
    this.clearFailedAttempts();

    // 发布事件
    this.addDomainEvent(
      new UserAuthenticatedEvent(
        this.user.id,
        tokens.accessToken.id,
        tokens.refreshToken.id,
      ),
    );

    return tokens;
  }

  async refreshToken(refreshTokenValue) {
    // 验证刷新令牌
    const refreshToken = this.activeTokens.find(
      (t) => t.type === 'refresh' && t.tokenValue === refreshTokenValue,
    );

    if (!refreshToken || refreshToken.isExpired()) {
      throw new DomainError('无效的刷新令牌');
    }

    // 生成新的访问令牌
    const newAccessToken = await this.generateAccessToken();

    // 可选：轮换刷新令牌
    if (this.shouldRotateRefreshToken(refreshToken)) {
      const newRefreshToken = await this.generateRefreshToken();
      refreshToken.revoke();

      this.addDomainEvent(
        new TokenRotatedEvent(
          this.user.id,
          refreshToken.id,
          newRefreshToken.id,
        ),
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    }

    return { accessToken: newAccessToken };
  }

  // 令牌管理
  async revokeToken(tokenValue) {
    const token = this.activeTokens.find((t) => t.tokenValue === tokenValue);
    if (token) {
      token.revoke();
      this.addDomainEvent(new TokenRevokedEvent(token.id));
    }
  }

  async revokeAllTokens() {
    for (const token of this.activeTokens) {
      token.revoke();
    }

    this.addDomainEvent(new AllTokensRevokedEvent(this.user.id));
  }
}
```

## 🔧 领域服务 (Domain Services)

### 用户领域服务 (UserDomainService)

```javascript
class UserDomainService {
  constructor(userRepository, roleRepository, eventPublisher) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.eventPublisher = eventPublisher;
  }

  /**
   * 用户注册领域服务
   */
  async registerUser(registrationData) {
    // 验证用户名唯一性
    const existingUser = await this.userRepository.findByUsername(
      registrationData.username,
    );
    if (existingUser) {
      throw new DomainError('用户名已存在');
    }

    // 验证邮箱唯一性
    const existingEmail = await this.userRepository.findByEmail(
      registrationData.email,
    );
    if (existingEmail) {
      throw new DomainError('邮箱已被注册');
    }

    // 检查密码强度
    if (!this.isPasswordStrong(registrationData.password)) {
      throw new DomainError('密码强度不足');
    }

    // 创建用户
    const user = new User({
      username: registrationData.username,
      email: registrationData.email,
      passwordHash: await this.hashPassword(registrationData.password),
    });

    // 保存用户
    await this.userRepository.save(user);

    // 发布领域事件
    await this.eventPublisher.publish(new UserRegisteredEvent(user.id));

    return user;
  }

  /**
   * 批量用户权限检查
   */
  async checkBulkPermissions(userIds, requiredPermissions) {
    const users = await this.userRepository.findByIds(userIds);
    const roles = await this.roleRepository.findByUserIds(userIds);

    const results = new Map();

    for (const user of users) {
      const userRoles = roles.filter((r) => r.userId === user.id);
      const userPermissions = this.calculateUserPermissions(user, userRoles);

      const hasAllPermissions = requiredPermissions.every((perm) =>
        this.hasPermission(userPermissions, perm),
      );

      results.set(user.id, hasAllPermissions);
    }

    return results;
  }

  /**
   * 用户状态转换
   */
  async transitionUserState(userId, newState, reason) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new DomainError('用户不存在');
    }

    // 状态机验证
    if (!this.isValidStateTransition(user.state, newState)) {
      throw new DomainError('无效的状态转换');
    }

    // 执行状态转换
    const oldState = user.state;
    user.state = newState;
    user.stateChangedAt = new Date();
    user.stateChangeReason = reason;

    await this.userRepository.save(user);

    // 发布状态变更事件
    await this.eventPublisher.publish(
      new UserStateChangedEvent(userId, oldState, newState, reason),
    );

    return user;
  }

  // 辅助方法
  isPasswordStrong(password) {
    // 密码强度规则
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }

  calculateUserPermissions(user, roles) {
    const permissions = new Set(user.permissions);

    for (const role of roles) {
      for (const permission of role.permissions) {
        permissions.add(permission);
      }
    }

    return Array.from(permissions);
  }

  hasPermission(userPermissions, requiredPermission) {
    return userPermissions.some((perm) =>
      this.matchesPermission(perm, requiredPermission),
    );
  }
}
```

### 认证领域服务 (AuthDomainService)

```javascript
class AuthDomainService {
  constructor(
    userRepository,
    tokenRepository,
    passwordHasher,
    tokenGenerator,
    eventPublisher,
  ) {
    this.userRepository = userRepository;
    this.tokenRepository = tokenRepository;
    this.passwordHasher = passwordHasher;
    this.tokenGenerator = tokenGenerator;
    this.eventPublisher = eventPublisher;
  }

  /**
   * 用户认证
   */
  async authenticate(credentials) {
    // 查找用户
    const user = await this.userRepository.findByUsername(credentials.username);
    if (!user) {
      throw new DomainError('用户不存在');
    }

    // 验证密码
    const isValidPassword = await this.passwordHasher.verify(
      credentials.password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      // 记录失败尝试
      await this.recordFailedLoginAttempt(user.id, credentials);
      throw new DomainError('密码错误');
    }

    // 检查账户状态
    if (!user.isActive) {
      throw new DomainError('账户已被停用');
    }

    // 生成令牌
    const tokens = await this.generateTokens(user);

    // 更新最后登录时间
    user.updateLastLogin();
    await this.userRepository.save(user);

    // 清理失败尝试记录
    await this.clearFailedLoginAttempts(user.id);

    // 发布认证成功事件
    await this.eventPublisher.publish(new UserAuthenticatedEvent(user.id));

    return {
      user: user.toPublicDTO(),
      tokens,
    };
  }

  /**
   * 令牌刷新
   */
  async refreshToken(refreshTokenValue) {
    // 验证刷新令牌
    const refreshToken =
      await this.tokenRepository.findByValue(refreshTokenValue);
    if (!refreshToken || refreshToken.type !== 'refresh') {
      throw new DomainError('无效的刷新令牌');
    }

    if (refreshToken.isExpired()) {
      throw new DomainError('刷新令牌已过期');
    }

    // 获取用户
    const user = await this.userRepository.findById(refreshToken.userId);
    if (!user || !user.isActive) {
      throw new DomainError('用户不存在或已被停用');
    }

    // 生成新令牌
    const newTokens = await this.generateTokens(user);

    // 可选：实现令牌轮换
    if (this.shouldRotateRefreshToken(refreshToken)) {
      refreshToken.revoke();
      await this.tokenRepository.save(refreshToken);
    }

    return newTokens;
  }

  /**
   * 令牌撤销
   */
  async revokeToken(tokenValue) {
    const token = await this.tokenRepository.findByValue(tokenValue);
    if (token) {
      token.revoke();
      await this.tokenRepository.save(token);

      await this.eventPublisher.publish(new TokenRevokedEvent(token.id));
    }
  }

  /**
   * 批量令牌撤销
   */
  async revokeAllUserTokens(userId) {
    const tokens = await this.tokenRepository.findByUserId(userId);

    for (const token of tokens) {
      token.revoke();
      await this.tokenRepository.save(token);
    }

    await this.eventPublisher.publish(new AllUserTokensRevokedEvent(userId));
  }

  // 辅助方法
  async generateTokens(user) {
    const accessToken = new Token({
      userId: user.id,
      type: 'access',
      tokenValue: this.tokenGenerator.generate(),
      expiresAt: new Date(Date.now() + 3600000), // 1小时
    });

    const refreshToken = new Token({
      userId: user.id,
      type: 'refresh',
      tokenValue: this.tokenGenerator.generate(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000), // 7天
    });

    await this.tokenRepository.save(accessToken);
    await this.tokenRepository.save(refreshToken);

    return {
      accessToken: {
        value: accessToken.tokenValue,
        expiresAt: accessToken.expiresAt,
      },
      refreshToken: {
        value: refreshToken.tokenValue,
        expiresAt: refreshToken.expiresAt,
      },
    };
  }

  shouldRotateRefreshToken(refreshToken) {
    // 刷新令牌轮换策略：令牌超过一半生命周期时轮换
    const halfLife = (refreshToken.expiresAt - refreshToken.issuedAt) / 2;
    const age = Date.now() - refreshToken.issuedAt;

    return age > halfLife;
  }
}
```

## 📚 仓储接口 (Repository Interfaces)

### 用户仓储接口

```javascript
interface UserRepository {
  // 基本CRUD操作
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  delete(id: string): Promise<void>;

  // 按属性查找
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;

  // 条件查询
  findBySpecification(spec: UserSpecification): Promise<User[]>;
  countBySpecification(spec: UserSpecification): Promise<number>;

  // 分页查询
  findPaged(spec: UserSpecification, page: number, limit: number): Promise<{
    users: User[];
    total: number;
    page: number;
    limit: number;
  }>;

  // 批量操作
  saveBulk(users: User[]): Promise<void>;
  deleteBulk(ids: string[]): Promise<void>;

  // 特殊查询
  findActiveUsers(): Promise<User[]>;
  findUsersByRole(roleId: string): Promise<User[]>;
  findUsersCreatedAfter(date: Date): Promise<User[]>;
}

// 用户规约接口
interface UserSpecification {
  isSatisfiedBy(user: User): boolean;

  // 组合规约
  and(other: UserSpecification): UserSpecification;
  or(other: UserSpecification): UserSpecification;
  not(): UserSpecification;
}

// 具体规约实现
class ActiveUsersSpecification implements UserSpecification {
  isSatisfiedBy(user: User): boolean {
    return user.isActive;
  }
}

class UsersByRoleSpecification implements UserSpecification {
  constructor(private roleId: string) {}

  isSatisfiedBy(user: User): boolean {
    return user.hasRole(this.roleId);
  }
}

class UsersCreatedAfterSpecification implements UserSpecification {
  constructor(private date: Date) {}

  isSatisfiedBy(user: User): boolean {
    return user.createdAt > this.date;
  }
}
```

### 仓储实现示例

```javascript
class PostgreSQLUserRepository implements UserRepository {
  constructor(databaseConnection) {
    this.db = databaseConnection;
  }

  async save(user) {
    const data = user.toDTO();
    await this.db('users').insert(data).onConflict('id').merge();
  }

  async findById(id) {
    const data = await this.db('users').where({ id }).first();
    return data ? User.fromDTO(data) : null;
  }

  async findBySpecification(spec) {
    let query = this.db('users');

    // 这里需要实现规约到SQL的转换
    // 这是一个简化的示例
    if (spec instanceof ActiveUsersSpecification) {
      query = query.where('is_active', true);
    }

    const results = await query;
    return results.map(data => User.fromDTO(data));
  }

  async findPaged(spec, page, limit) {
    const offset = (page - 1) * limit;

    let query = this.db('users');
    // 应用规约...

    const [results, countResult] = await Promise.all([
      query.limit(limit).offset(offset),
      query.count('id as count').first(),
    ]);

    return {
      users: results.map(data => User.fromDTO(data)),
      total: parseInt(countResult.count),
      page,
      limit,
    };
  }
}
```

## 📢 领域事件 (Domain Events)

### 领域事件基类

```javascript
class BaseDomainEvent {
  constructor(aggregateId, eventId = null, occurredAt = null) {
    this.aggregateId = aggregateId;
    this.eventId = eventId || uuidv4();
    this.occurredAt = occurredAt || new Date();
    this.eventVersion = 1;
  }
}

// 用户领域事件
class UserCreatedEvent extends BaseDomainEvent {
  constructor(userId, username, email) {
    super(userId);
    this.username = username;
    this.email = email;
    this.eventType = 'UserCreated';
  }
}

class UserAuthenticatedEvent extends BaseDomainEvent {
  constructor(userId, accessTokenId, refreshTokenId) {
    super(userId);
    this.accessTokenId = accessTokenId;
    this.refreshTokenId = refreshTokenId;
    this.eventType = 'UserAuthenticated';
  }
}

class UserRoleAssignedEvent extends BaseDomainEvent {
  constructor(userId, roleId) {
    super(userId);
    this.roleId = roleId;
    this.eventType = 'UserRoleAssigned';
  }
}

// 工作流领域事件
class WorkflowCreatedEvent extends BaseDomainEvent {
  constructor(workflowId, name, creatorId) {
    super(workflowId);
    this.name = name;
    this.creatorId = creatorId;
    this.eventType = 'WorkflowCreated';
  }
}

class WorkflowExecutedEvent extends BaseDomainEvent {
  constructor(workflowId, executionId, status) {
    super(workflowId);
    this.executionId = executionId;
    this.status = status;
    this.eventType = 'WorkflowExecuted';
  }
}
```

### 领域事件发布器

```javascript
class DomainEventPublisher {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.publishedEvents = new Map();
  }

  async publish(event) {
    // 添加到已发布事件集合
    if (!this.publishedEvents.has(event.aggregateId)) {
      this.publishedEvents.set(event.aggregateId, []);
    }
    this.publishedEvents.get(event.aggregateId).push(event);

    // 发布到事件总线
    await this.eventBus.publish(event.eventType, event);

    // 可选：持久化事件
    await this.persistEvent(event);
  }

  async publishAll(aggregate) {
    const unpublishedEvents = aggregate.getUnpublishedEvents();

    for (const event of unpublishedEvents) {
      await this.publish(event);
    }

    aggregate.clearUnpublishedEvents();
  }

  getPublishedEvents(aggregateId) {
    return this.publishedEvents.get(aggregateId) || [];
  }

  async persistEvent(event) {
    // 将事件保存到事件存储
    await this.eventStore.save(event);
  }
}
```

### 领域事件处理器

```javascript
class DomainEventHandlers {
  constructor(eventBus, services) {
    this.eventBus = eventBus;
    this.services = services;
    this.registerHandlers();
  }

  registerHandlers() {
    // 用户创建事件处理器
    this.eventBus.on('UserCreated', async (event) => {
      await this.handleUserCreated(event);
    });

    // 用户认证事件处理器
    this.eventBus.on('UserAuthenticated', async (event) => {
      await this.handleUserAuthenticated(event);
    });

    // 工作流创建事件处理器
    this.eventBus.on('WorkflowCreated', async (event) => {
      await this.handleWorkflowCreated(event);
    });
  }

  async handleUserCreated(event) {
    // 发送欢迎邮件
    await this.services.emailService.sendWelcomeEmail(event.email);

    // 创建用户默认设置
    await this.services.userService.createDefaultSettings(event.aggregateId);

    // 记录用户注册统计
    await this.services.analyticsService.recordUserRegistration(event);
  }

  async handleUserAuthenticated(event) {
    // 更新用户登录统计
    await this.services.analyticsService.recordUserLogin(event);

    // 检查账户安全
    await this.services.securityService.checkAccountSecurity(event.aggregateId);

    // 发送登录通知（可选）
    if (
      await this.services.userService.hasLoginNotificationsEnabled(
        event.aggregateId,
      )
    ) {
      await this.services.notificationService.sendLoginNotification(event);
    }
  }

  async handleWorkflowCreated(event) {
    // 验证工作流定义
    await this.services.workflowService.validateWorkflow(event.aggregateId);

    // 初始化工作流统计
    await this.services.analyticsService.initializeWorkflowStats(
      event.aggregateId,
    );

    // 通知相关用户
    await this.services.notificationService.notifyWorkflowCreation(event);
  }
}
```

## 📋 规范模式 (Specification Pattern)

### 规约接口和实现

```javascript
// 规约接口
interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

// 组合规约基类
class CompositeSpecification<T> implements Specification<T> {
  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

// 逻辑运算规约
class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}
```

### 用户规约实现

```javascript
// 用户状态规约
class ActiveUserSpecification extends CompositeSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive;
  }
}

class VerifiedEmailSpecification extends CompositeSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isEmailVerified;
  }
}

class AdminRoleSpecification extends CompositeSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.hasRole('admin');
  }
}

// 复合规约示例
class PremiumUserSpecification extends CompositeSpecification<User> {
  isSatisfiedBy(user: User): boolean {
    return new ActiveUserSpecification()
      .and(new VerifiedEmailSpecification())
      .and(new AdminRoleSpecification().not())
      .isSatisfiedBy(user);
  }
}

// 时间范围规约
class UserCreatedInRangeSpecification extends CompositeSpecification<User> {
  constructor(private startDate: Date, private endDate: Date) {
    super();
  }

  isSatisfiedBy(user: User): boolean {
    return user.createdAt >= this.startDate && user.createdAt <= this.endDate;
  }
}

// 复杂规约组合
const complexUserSpec = new ActiveUserSpecification()
  .and(new VerifiedEmailSpecification())
  .and(new UserCreatedInRangeSpecification(
    new Date('2024-01-01'),
    new Date('2024-12-31')
  ));
```

## 🔧 依赖注入配置

### 领域服务注册

```javascript
import { container } from 'frys';

// 注册实体工厂
container.register('userFactory', () => new UserFactory());
container.register('roleFactory', () => new RoleFactory());
container.register('tokenFactory', () => new TokenFactory());

// 注册仓储
container.register(
  'userRepository',
  (c) => new PostgreSQLUserRepository(c.resolve('database')),
);
container.register(
  'roleRepository',
  (c) => new PostgreSQLRoleRepository(c.resolve('database')),
);
container.register(
  'tokenRepository',
  (c) => new PostgreSQLTokenRepository(c.resolve('database')),
);

// 注册领域服务
container.register(
  'userDomainService',
  (c) =>
    new UserDomainService(
      c.resolve('userRepository'),
      c.resolve('roleRepository'),
      c.resolve('eventPublisher'),
    ),
);

container.register(
  'authDomainService',
  (c) =>
    new AuthDomainService(
      c.resolve('userRepository'),
      c.resolve('tokenRepository'),
      c.resolve('passwordHasher'),
      c.resolve('tokenGenerator'),
      c.resolve('eventPublisher'),
    ),
);

// 注册规约
container.register('userSpecifications', () => ({
  active: new ActiveUserSpecification(),
  verified: new VerifiedEmailSpecification(),
  premium: new PremiumUserSpecification(),
}));
```

## 📊 监控和指标

### 领域层指标

```javascript
// 实体创建指标
const entityMetrics = {
  usersCreated: await userRepository.count(),
  activeUsers: await userRepository.countBySpecification(
    new ActiveUserSpecification(),
  ),
  rolesAssigned: await roleRepository.count(),
  tokensIssued: await tokenRepository.countByType('access'),
};

// 领域服务指标
const domainServiceMetrics = {
  authenticationAttempts: await authDomainService.getAuthenticationAttempts(),
  successfulAuthentications:
    await authDomainService.getSuccessfulAuthentications(),
  failedAuthentications: await authDomainService.getFailedAuthentications(),
  averageAuthenticationTime:
    await authDomainService.getAverageAuthenticationTime(),
};

// 仓储性能指标
const repositoryMetrics = {
  userQueriesPerSecond: await userRepository.getQueriesPerSecond(),
  averageQueryTime: await userRepository.getAverageQueryTime(),
  cacheHitRate: await userRepository.getCacheHitRate(),
};
```

## 🧪 测试策略

### 实体单元测试

```javascript
import { describe, it, expect } from 'vitest';
import { User, Username, Email } from '../domain/entities/auth/User.js';

describe('User Entity', () => {
  it('should create user successfully', () => {
    const user = new User({
      id: 'user-123',
      username: 'john_doe',
      email: 'john@example.com',
      passwordHash: 'hashed_password',
    });

    expect(user.id).toBe('user-123');
    expect(user.username).toBe('john_doe');
    expect(user.email).toBe('john@example.com');
    expect(user.isActive).toBe(true);
    expect(user.roles).toEqual([]);
  });

  it('should validate username format', () => {
    expect(() => new Username('ab')).toThrow('用户名长度必须在3-50个字符之间');
    expect(() => new Username('user@domain')).toThrow(
      '用户名只能包含字母、数字、下划线和连字符',
    );
    expect(() => new Username('valid_user')).not.toThrow();
  });

  it('should validate email format', () => {
    expect(() => new Email('invalid-email')).toThrow('邮箱格式无效');
    expect(() => new Email('user@domain.com')).not.toThrow();
  });

  it('should assign and check permissions', () => {
    const user = new User({
      id: 'user-123',
      username: 'john_doe',
      email: 'john@example.com',
      passwordHash: 'hashed_password',
    });

    user.assignPermission('read:profile');
    user.assignPermission('admin:*');

    expect(user.hasPermission('read:profile')).toBe(true);
    expect(user.hasPermissionWildcard('admin:users')).toBe(true);
    expect(user.hasPermissionWildcard('write:profile')).toBe(false);
  });
});
```

### 领域服务集成测试

```javascript
describe('UserDomainService', () => {
  let userRepository;
  let roleRepository;
  let domainService;

  beforeEach(() => {
    userRepository = {
      findByUsername: vi.fn(),
      findByEmail: vi.fn(),
      save: vi.fn(),
    };

    roleRepository = {
      findById: vi.fn(),
    };

    domainService = new UserDomainService(userRepository, roleRepository, {
      publish: vi.fn(),
    });
  });

  it('should register user successfully', async () => {
    userRepository.findByUsername.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.save.mockResolvedValue();

    const user = await domainService.registerUser({
      username: 'john_doe',
      email: 'john@example.com',
      password: 'StrongPass123!',
    });

    expect(userRepository.save).toHaveBeenCalled();
    expect(user.username).toBe('john_doe');
  });

  it('should reject duplicate username', async () => {
    userRepository.findByUsername.mockResolvedValue(
      new User({
        id: 'existing',
        username: 'john_doe',
        email: 'existing@example.com',
      }),
    );

    await expect(
      domainService.registerUser({
        username: 'john_doe',
        email: 'new@example.com',
        password: 'StrongPass123!',
      }),
    ).rejects.toThrow('用户名已存在');
  });
});
```

## ❓ 常见问题

### Q: 如何设计聚合根的边界？

**A:** 聚合根边界设计原则：

- **业务一致性**: 聚合内部保持强一致性
- **事务边界**: 聚合内的修改必须在同一事务中完成
- **性能考虑**: 聚合大小不应影响性能
- **并发控制**: 使用乐观锁或悲观锁处理并发冲突

```javascript
// 聚合设计示例
class OrderAggregate {
  constructor(order, orderItems, customer) {
    this.order = order;
    this.orderItems = orderItems;
    this.customer = customer;
  }

  // 业务方法确保聚合内一致性
  async addItem(productId, quantity) {
    // 验证库存
    const product = await this.productRepository.findById(productId);
    if (product.stock < quantity) {
      throw new DomainError('库存不足');
    }

    // 添加订单项
    const orderItem = new OrderItem({
      orderId: this.order.id,
      productId,
      quantity,
      unitPrice: product.price,
    });

    this.orderItems.push(orderItem);

    // 更新订单总价
    this.order.totalAmount += orderItem.getTotalPrice();

    // 预留库存
    product.reserveStock(quantity);
    await this.productRepository.save(product);
  }
}
```

### Q: 值对象和实体有什么区别？

**A:** 值对象和实体的主要区别：

- **标识**: 实体有唯一标识，值对象无唯一标识
- **可变性**: 值对象不可变，实体可变
- **相等性**: 值对象按值比较，实体按标识比较
- **生命周期**: 值对象从属于实体，随实体一起创建和销毁

```javascript
// 值对象示例
class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
    Object.freeze(this); // 不可变
  }

  add(other) {
    if (this.currency !== other.currency) {
      throw new Error('货币类型不匹配');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other) {
    return this.amount === other.amount && this.currency === other.currency;
  }
}

// 实体示例
class Account {
  constructor(id, balance) {
    this.id = id; // 唯一标识
    this.balance = balance; // 可变状态
  }

  deposit(amount) {
    this.balance = this.balance.add(amount); // 返回新值对象
  }

  equals(other) {
    return this.id === other.id; // 按标识比较
  }
}
```

### Q: 如何处理领域事件的最终一致性？

**A:** 领域事件最终一致性处理策略：

```javascript
// 事件驱动的最终一致性
class OrderService {
  async placeOrder(orderData) {
    // 1. 在本地事务中创建订单
    const order = await this.createOrderInTransaction(orderData);

    // 2. 发布领域事件（异步）
    setImmediate(() => {
      this.eventPublisher.publish(new OrderPlacedEvent(order.id));
    });

    return order;
  }
}

// 事件处理器确保最终一致性
class OrderEventHandlers {
  async handleOrderPlaced(event) {
    try {
      // 预留库存
      await this.inventoryService.reserveStock(event.orderId);

      // 发送确认邮件
      await this.emailService.sendOrderConfirmation(event.orderId);

      // 更新统计
      await this.analyticsService.recordOrder(event.orderId);
    } catch (error) {
      // 补偿操作
      await this.handleOrderPlacementFailure(event, error);
    }
  }

  async handleOrderPlacementFailure(event, error) {
    // 记录失败
    await this.errorLogService.logEventFailure(event, error);

    // 可选：重试或人工干预
    if (this.shouldRetry(error)) {
      await this.scheduleRetry(event);
    } else {
      await this.notifyAdmin(event, error);
    }
  }
}
```

## 📚 相关链接

- [应用服务层文档](application-layer.md) - 应用服务层的实现
- [基础设施层文档](infrastructure-layer.md) - 基础设施实现
- [测试策略](../testing/testing-architecture.md) - 测试最佳实践
- [Eric Evans - Domain-Driven Design](https://domainlanguage.com/ddd/) - DDD经典著作
