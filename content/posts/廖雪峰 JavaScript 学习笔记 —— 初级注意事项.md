---
title: 一些简单的初级注意事项
author: June
date: 2026-04-06
tags: 
  - 学习
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

#### 1.3.1 Map

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



#### 1.3.2 Set

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



#### 1.3.3 forEach

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



```javascript
// Set与Array类似，但Set没有索引，因此回调函数的前两个参数都是元素本身：
let s = new Set(['A', 'B', 'C']);
s.forEach(function (element, sameElement, set) {
    console.log(element);
});

// Map的回调函数参数依次为value、key和map本身：
let m = new Map([[1, 'x'], [2, 'y'], [3, 'z']]);
m.forEach(function (value, key, map) {
    console.log(value);
});
```



## 2、函数

`JavaScript`函数允许接收任意个参数，而且只会用到`<= arguments.length`个数的参数，如下面的`abs(10,-100)`只会用到10，二忽视-100，剩下的这些不要的参数我们放到了`rest`里面去。

```javascript
function abs(x) {
    if (x >= 0) {
        return x;
    } else {
        return -x;
    }
}
```



### 2.1 arguments

`JavaScript`里面的函数，自动带一个参数`arguments`，且永远指向当前函数的调用者传入的所有参数，这也说明了即使函数不定义任何参数，还是可以拿到参数的值。

```javascript
function foo(x) {
    if (arguments.length === 0) {
        return 0;
    } else {
    console.log('x = ' + x); // 10
    }
    for (let i=0; i<arguments.length; i++) {
        console.log('arg ' + i + ' = ' + arguments[i]); // 10, 20, 30
    }
}
foo(10, 20, 30);
foo();
```

```tetx
x = 10
arg 0 = 10
arg 1 = 20
arg 2 = 30
```



而且在ES6中，可以用`...rest`来指代这些被忽略的剩余参数，因为他们也有未竟的作用，注意在使用的时候应该用`rest`而非`...rest`。

```javascript
function foo(a, b, ...rest) {
    console.log('a = ' + a);
    console.log('b = ' + b);
    console.log(rest);
}

foo(1, 2, 3, 4, 5);
```

```javascript
// a = 1
// b = 2
// Array [ 3, 4, 5 ]
```



### 2.2 return的坑

`JavaScript`引擎有一个在行末自动添加分号的机制，这可能让你栽到`return`语句的一个大坑：

```javascript
function foo() {
    return { name: 'foo' };
}

foo(); // { name: 'foo' }
```

如果把`return`语句拆成两行：

```javascript
function foo() {
    return
        { name: 'foo' };
}

foo(); // undefined
```

*要小心了*，由于`JavaScript`引擎在行末自动添加分号的机制，上面的代码实际上变成了：

```javascript
function foo() {
    return; // 自动添加了分号，相当于return undefined;
        { name: 'foo' }; // 这行语句已经没法执行到了
}
```

所以正确的多行写法是：

```javascript
function foo() {
    return { // 这里不会自动加分号，因为{表示语句尚未结束
        name: 'foo'
    };
}
```



### 2.3 变量提升

`JavaScript`的函数定义有个特点，它会先扫描整个函数体的语句，把所有用`var`申明的变量“提升”到函数顶部：

```javascript
function foo() {
    var x = 'Hello, ' + y;
    console.log(x);
    var y = 'Bob';
}

foo();
// Hello, undefined
```

- 虽然是strict模式，但语句`var x = 'Hello, ' + y;`并不报错，原因是变量`y`在稍后申明了。但是`console.log`显示`Hello, undefined`，说明变量`y`的值为`undefined`。这正是因为JavaScript引擎自动提升了变量`y`的声明，但不会提升变量`y`的赋值。

- 如果后续不声明`y`，会报错。

- 由于JavaScript的这一怪异的“特性”，我们在函数内部定义变量时，请严格遵守“在函数内部首先申明所有变量”这一规则。最常见的做法是用一个`var`申明函数内部用到的所有变量。



### 2.4 全局变量

全局变量都绑定在`window`身上的。

```javascript
function foo() {
    alert('foo');
}

foo(); // 直接调用foo()
window.foo(); // 通过window.foo()调用
```



### 2.5 局部作用域

由于JavaScript的变量作用域实际上是函数内部，我们在`for`循环等语句块中是无法定义具有局部作用域的变量的，但是改成`ES6`中的`let`就可以做到，`for`循环里面的`let`变量在外部无法访问。

```javascript
function foo() {
    for (var i=0; i<100; i++) {
    // for (let i=0; i<100; i++) {
        //
    }
    i += 100; // 仍然可以引用变量i
}
```



### 2.6 解构赋值

#### 2.6.1 array

```javascript
let [x, [y, z]] = ['hello', ['JavaScript', 'ES6']];
x; // 'hello'
y; // 'JavaScript'
z; // 'ES6'
```



#### 2.6.2 对象

如果需要从一个对象中取出若干属性，也可以使用解构赋值，便于快速获取对象的指定属性：

```javascript
let person = {
    name: '小明',
    age: 20,
    gender: 'male',
    passport: 'G-12345678',
    school: 'No.4 middle school'
};
let {name, age, passport} = person;

// name, age, passport分别被赋值为对应属性:
console.log(`name = ${name}, age = ${age}, passport = ${passport}`);
// name = 小明, age = 20, passport = G-12345678
```



果要使用的变量名和属性名不一致，可以用下面的语法获取

```javascript
let {name, passport:id} = person;
name; // '小明'
id; // 'G-12345678'
// 注意: passport不是变量，而是为了让变量id获得passport属性:
passport; // Uncaught ReferenceError: passport is not defined
```



如果person对象没有single属性，默认赋值为true

```javascript
let {name, single=true} = person;
```



有些时候，如果变量已经被声明了，再次赋值的时候，正确的写法也会报语法错误

```javascript
// 声明变量:
let x, y;
{x, y} = { name: '小明', x: 100, y: 200};
// 语法错误: Uncaught SyntaxError: Unexpected token =
```



这是因为JavaScript引擎把`{`开头的语句当作了块处理，于是`=`不再合法。解决方法是用小括号括起来：

```javascript
let x, y;
({x, y} = { name: '小明', x: 100, y: 200});
```



### 2.7 this? that?

#### 2.7.1 古老方法

在一个方法内部，`this`是一个特殊变量，它始终指向当前对象，也就是`xiaoming`这个变量。所以，`this.birth`可以拿到`xiaoming`的`birth`属性。

```javascript
let xiaoming = {
    name: '小明',
    birth: 1990,
    age: getAge = function () {
        let y = new Date().getFullYear();
        return y - this.birth;
    }
};

console.log(xiaoming.age); // function xiaoming.age()
console.log(xiaoming.age()); // 今年调用是36,明年调用就变成37了

// 但是直接用getAge会爆粗，因为他的this没来
```



 如果对象内部属性指向一个函数，且函数内部使用了`this`，此时如果从外部去获取这个对象里面的这个属性（函数），会报错，因为那个函数里面使用的`this`指向那个对象，你在外部调用就指向了`window`了！

而且，对象属性里面函数如果嵌套了一个函数，嵌套函数里面用`this`是拿不到这个对象的，而是指向`window`，除非提前用`that`捕获这个对象，然后通过`内部函数可以访问外部变量，外部函数不能访问内部变量`的特性，从而让嵌套函数内的`this`重新指向该对象，即`that`。

```javascript
'use strict';

let xiaoming = {
    name: '小明',
    birth: 1990,
    age: function () {
        let that = this; // 在方法内部一开始就捕获this
        function getAgeFromBirth() {
            let y = new Date().getFullYear();
            return y - that.birth; // 用that而不是this
        }
        return getAgeFromBirth();
    }
};

xiaoming.age(); // 25
```



#### 2.7.2 apply

可以用`apply`改变`this`的指向对象，它接收两个参数，第一个参数就是需要绑定的`this`变量，第二个参数是`Array`，表示函数本身的参数。

```javascript
function getAge() {
    let y = new Date().getFullYear();
    return y - this.birth;
}

let xiaoming = {
    name: '小明',
    birth: 1990,
    age: getAge
};

console.log(xiaoming.age()); // 25
console.log(getAge.apply(xiaoming, [])); // 25, this指向xiaoming, 参数为空
```



#### 2.7.3 call

类似`apply`，区别在于：

- `apply()`把参数打包成`Array`再传入；
- `call()`把参数按顺序传入。

比如调用`Math.max(3, 5, 4)`，分别用`apply()`和`call()`实现如下：

```javascript
Math.max.apply(null, [3, 5, 4]); // 5
Math.max.call(null, 3, 5, 4); // 5
```

对普通函数调用，我们通常把`this`绑定为`null`



#### 2.7.4 装饰器

`JavaScript`的所有对象都是动态的，即使内置的函数，我们也可以重新指向新的函数。

```javascript
'use strict';

let count = 0;
let oldParseInt = parseInt; // 保存原函数

window.parseInt = function () {
    count += 1;
    return oldParseInt.apply(null, arguments); // 调用原函数
};

// 测试:
parseInt('10');
parseInt('20');
parseInt('30');
console.log('count = ' + count); // 3
```

