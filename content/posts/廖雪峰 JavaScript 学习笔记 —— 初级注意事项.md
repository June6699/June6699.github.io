---
title: 一些简单的初级注意事项
author: June
date: 2026-04-06
tags: - 学习
      - 学习/前端
---

## 1、快速入门阶段

https://liaoxuefeng.com/books/javascript/quick-start/index.html

### 1.1 循环

- `for`循环里面需要用 `;`，而非`,`；
- `for`循环对于`array`的循环，一般用`< arr.length`而非`<= arr.length`，因为`length`不存在0，但是`index`存在0（与`python`一样）；

```javascript
let arr = ['Apple', 'Google', 'Microsoft'];
let i, x;
for (i=0; i<arr.length; i++) {
    x = arr[i];
    console.log(x);
}
```



### 1.2 对象

- 对象里面需要用`,`隔开各个属性，尾部用`;`结尾；

```javascript
let xiaohong = {
    name: '小红',
    'middle-school': 'No.1 Middle School'
};
```





### 1.3 Map和Set、Iterable

- `Map`可以用来快速使用两个`array`创建一个`object`

```javascript
let names = ['Michael', 'Bob', 'Tracy'];
let scores = [95, 75, 85];

// 方法零
let m = new Map([['Michael', 95], ['Bob', 75], ['Tracy', 85]]);
m.get('Michael'); // 95

// 方法一
let m = new Map();
for (let i = 0; i < names.length; i++) {
    m.set(names[i], scores[i]);
}

// 方法二
let m = new Map(names.map((name, index) => [name, scores[index]]));

console.log(m.get('Michael')); // 输出 95
console.log(m); // 打印完整Map（可选）
```

==方法二讲解==

`names.map()` = 遍历 `names` 数组里的每一个名字，循环处理，并拿到`index` 012
它会自动循环 3 次（因为 `names` 有 3 个元素）

```JavaScript
names.map((name, index) => [name, scores[index]])
```

会自动生成一个二维数组（正好是 Map 需要的格式）：

```JavaScript
[
  ['Michael', 95],
  ['Bob', 75],
  ['Tracy', 85]
]
```



- `Set`类似`python`元组，自动过滤重复元素

```javascript
let s = new Set([1, 2, 3, 3, '3']);
s; // Set {1, 2, 3, "3"}
```



- 遍历`Array`可以采用下标循环，遍历`Map`和`Set`就无法使用下标。为了统一集合类型，ES6标准引入了新的`iterable`类型，`Array`、`Map`和`Set`都属于`iterable`类型。

```javascript
let a = ['A', 'B', 'C'];
let s = new Set(['A', 'B', 'C']);
let m = new Map([[1, 'x'], [2, 'y'], [3, 'z']]);
for (let x of a) { // 遍历Array
    console.log(x);
}
for (let x of s) { // 遍历Set
    console.log(x);
}
for (let x of m) { // 遍历Map
    console.log(x[0] + '=' + x[1]);
}
```



- `for ... of`循环它只循环集合本身的元素：

```javascript
let a = ['A', 'B', 'C'];
a.name = 'Hello';
for (let x of a) {
    console.log(x); // 'A', 'B', 'C'
}
```



- 更好的方式是直接使用`iterable`内置的`forEach`方法，它接收一个函数，每次迭代就自动回调该函数

```javascript
let a = ['A', 'B', 'C'];
a.forEach(function (element, index, array) {
    // element: 指向当前元素的值
    // index: 指向当前索引
    // array: 指向Array对象本身
    console.log(`${element}, index = ${index}`);
});
```

```text
A, index = 0
B, index = 1
C, index = 2
```



