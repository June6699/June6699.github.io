---
title: JavaScript学习笔记：对象及面向对象编程
author: June
date: 2026-04-08
tags:
    - 技术
    - 技术/前端
    - 技术/前端/JavaScript
---

## 0、一些链接

> [!IMPORTANT]
>
> 文档手册：[JavaScript 和 HTML DOM 参考手册 | 菜鸟教程](https://www.runoob.com/jsref/jsref-tutorial.html)
>
> 廖雪峰（本笔记来源）：[廖雪峰 JavaScript教程](https://liaoxuefeng.com/books/javascript)
>
> 菜鸟教程：[JavaScript 教程 | 菜鸟教程](https://www.runoob.com/js/js-tutorial.html)



## 1、标准对象

 特别注意

JavaScript的Date对象月份值从0开始，牢记0=1月，1=2月，2=3月，……，11=12月。



## 2、JavaScript函数、对象与原型完整核心总结
### 2.1 函数与Object的本质关系
1. JS 遵循万物皆对象规则，函数本身就是一类特殊的 Object；普通对象只能挂载属性，函数既可以当对象挂载自定义属性，又能加 `()` 执行调用。
2. 所有函数能调用 `apply/call/bind`，不是函数自身自带，而是靠原型链继承而来。
3. 代码验证：
```javascript
// 函数是对象
function Student(name) {
    this.name = name;
    this.hello = function () {
        alert('Hello, ' + this.name + '!');
    }
}
// 检测类型
console.log(typeof Student); // function
console.log(Student instanceof Object); // true  函数属于Object
```

### 2.2 函数prototype属性本质
1. 只有函数天生自带 `prototype` 显式属性，函数的 prototype 不是函数，就是一个普通Object对象。
2. 函数默认的 `prototype` 对象自带 `constructor` 属性，默认指向构造函数自身。
3. 代码验证：
```javascript
// prototype 是普通对象
console.log(typeof Student.prototype); // object
// constructor 指向自己
console.log(Student.prototype.constructor === Student); // true
```

### 2.3 显式原型与隐式原型核心区别
1. 显式原型 prototype：仅构造函数独有，作用是作为模板，给 `new` 出来的实例共享属性和方法。
2. 隐式原型 proto：JS 所有东西都有（普通对象、实例、函数、数组），是引擎内置隐藏属性；作用是串联原型链，对象自身找不到属性时，顺着 `__proto__` 向上逐级查找。
3. 通用规则：任何对象的 `__proto__` 永远指向创建它的构造函数的 prototype。
```javascript
let obj = {};
console.log(obj.__proto__ === Object.prototype); // true

let arr = [];
console.log(arr.__proto__ === Array.prototype); // true
```

### 2.4 对象实例本身没有prototype的原因
1. 设计定位：`prototype` 是构造函数（工厂） 的专属模具，用来统一给实例提供公共模板；而 `new` 出来的实例只是「产品」，只需要使用模具，不需要自己再拥有一个模具。
2. 功能冗余：实例已经通过隐式原型 `__proto__` 指向构造函数的 `prototype`，完全能实现继承；如果再给实例加 `prototype` 属性，毫无实际作用，还浪费内存。
3. 代码验证实例无prototype：
```javascript
let xiaoming = new Student('小明');
console.log(xiaoming.prototype); // undefined  实例没有prototype
```

### 2.5 构造函数、原型、实例三者关联
基于你写的 Student 构造函数与 xiaoming 实例，完整原型关系：
1. `Student.prototype` 是普通对象，`constructor` 指向 Student；
2. 实例 `xiaoming.__proto__` 直接指向 `Student.prototype`；
3. `xiaoming` 自身没有 `constructor`，沿原型链向上查找，最终指向 Student。
```javascript
let xiaoming = new Student('小明');
console.log(xiaoming.__proto__ === Student.prototype); // true
console.log(xiaoming.constructor === Student); // true
// 实例可以正常访问属性和方法
console.log(xiaoming.name); // 小明
xiaoming.hello(); // 弹出 Hello, 小明!
```
补充：你代码里 `this.hello` 是绑定在每个实例自身，不是挂载在原型上，每个实例都会单独生成一份函数。

### 2.6 apply/call/bind 的原型来源
1. `apply、call、bind` 这些方法，定义在 Function.prototype 上；
2. 所有普通函数的隐式原型 `__proto__` 都指向 `Function.prototype`，通过原型链继承，所以所有函数天生能调用这三个方法。
```javascript
console.log(Student.__proto__ === Function.prototype); // true
```