---
title: 重构：Java 代码中消除 If-Else 语句以获得更清晰、可扩展的逻辑
author: 张权
top: false
cover: false
toc: true
mathjax: false
date: 2024-07-26 18:24:38
password:
summary: 重构：Java 代码中消除 If-Else 语句以获得更清晰、可扩展的逻辑
tags:
	- Java
	- 重构
categories: 重构
---

尽管 if-else 语句无处不在，但如果过度使用，可能会导致代码复杂且难以维护。在本文中，我们将探索各种策略来减少在项目中 if-else 结构的使用，重点是使代码更加模块化、可维护和可读。

![](https://cdn.jsdelivr.net/gh/dendi875/images/PicGo/20240726095112.png)

# 包含太多if-else语句的代码片段

在深入研究优化的细节之前，让我们使用一个带有多个if else条件的示例Java代码，然后以各种方式进行优化：

``` java
public class ShippingCostCalculator {
    public double calculateShippingCost(String shippingType, double weight) {
        if (shippingType.equals("STANDARD")) {
            return weight * 5.0;
        } else if (shippingType.equals("EXPRESS")) {
            return weight * 10.0;
        } else if (shippingType.equals("SAME_DAY")) {
            return weight * 20.0;
        } else if (shippingType.equals("INTERNATIONAL")) {
            return weight * 50.0;
        } else if (shippingType.equals("OVERNIGHT")) {
            return weight * 30.0;
        }
        return 0;
    }
}
```

上面的代码根据运输类型计算运费。

## 减少 If-Else 语句的策略

*   使用枚举

*   策略模式

*   多态性

*   Lambda表达式和函数式接口

*   命令模式

*   保护子句

让我们通过示例深入了解每种策略。

## 使用枚举

枚举可以用来表示一组预定义的常量及其相关行为。

现在，我们将使用enumt来替换if-else语句。

```java
public enum ShippingType {
	STANDARD {
		@Override
		public double getCost(double weight) {
			return weight * 5.0;
		}
	},
	EXPRESS {
		@Override
		public double getCost(double weight) {
			return weight * 10.0;
		}
	},
	SAME_DAY {
		@Override
		public double getCost(double weight) {
			return weight * 20.0;
		}
	},
	INTERNATIONAL {
		@Override
		public double getCost(double weight) {
			return weight * 50.0;
		}
	},
	OVERNIGHT {
		@Override
		public double getCost(double weight) {
			return weight * 30.0;
		}
	};

	public abstract double	getCost(double weight);
}
```

```java
public class ShippingCostCalculator {

	public double calculateShippingCost(ShippingType shippingType, double weight) {
		return shippingType.getCost(weight);
	}
}

```

```java
public class MainCost {

	public static void main(String[] args) {
		ShippingCostCalculator calculator = new ShippingCostCalculator();
		double cost = calculator.calculateShippingCost(ShippingType.EXPRESS, 2.5);
		System.out.println("Shipping cost: " + cost);
	}
}

// output: Shipping cost: 25.0
```

困难的 if-else 语句已简化为两行简短明了的代码。

优势：

*   可扩展性：添加新的运输类型和值。添加枚举并定义它的处理方法。
*   可维护和可理解的代码：每种运输方式的推理都是孤立的，易于理解。

但是，使用 Enum 有一些明显的缺点，您应该考虑：

*   可扩展性：添加新的运输类型和值。枚举并定义它的处理方法。
*   难以添加新参数：当需要更多参数时，Enum不太适合，并且代码变得繁琐。
*   继承限制：Enum 不能从其他类继承，这降低了它们重用逻辑的潜力。

使用Enum进行优化通常适用于参数较少的简单情况。

## 使用工厂模式优化

仍然是上面混乱的代码，我们将通过以下方式对其进行优化：

创建接口 ShippingCostStrategy

```java
public interface ShippingCostStrategy {
    double calculate(double weight);
}
```

接下来，我们将为每种运输类型的交付创建特定的类，实现上面的接口。

```java
public class StandardShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 5.0;
    }
}

public class ExpressShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 10.0;
    }
}

public class SameDayShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 20.0;
    }
}

public class InternationalShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 50.0;
    }
}

public class OvernightShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 30.0;
    }
}
```

现在，我们将创建一个工厂类来根据运输类型处理路由到策略

```java
import java.util.HashMap;
import java.util.Map;

public class ShippingCostFactory {
    private static final Map<String, ShippingCostStrategy> strategies = new HashMap<>();

    static {
        strategies.put("STANDARD", new StandardShipping());
        strategies.put("EXPRESS", new ExpressShipping());
        strategies.put("SAME_DAY", new SameDayShipping());
        strategies.put("INTERNATIONAL", new InternationalShipping());
        strategies.put("OVERNIGHT", new OvernightShipping());
    }

    public static ShippingCostStrategy getStrategy(String shippingType) {
        ShippingCostStrategy strategy = strategies.get(shippingType);
        if (strategy == null) {
            throw new IllegalArgumentException("Invalid shipping type: " + shippingType);
        }
        return strategy;
    }
}
```

现在只需调用它并使用它

```java
public class ShippingCostCalculator {
    public double calculateShippingCost(String shippingType, double weight) {
        ShippingCostStrategy strategy = ShippingCostFactory.getStrategy(shippingType);
        return strategy.calculate(weight);
    }
}
```

```java
public class MainCost {

	public static void main(String[] args) {
		ShippingCostCalculator calculator = new ShippingCostCalculator();
		double cost = calculator.calculateShippingCost("EXPRESS", 2.5);
		System.out.println("Shipping cost: " + cost);
	}
}

// output:
// Shipping cost: 25.0
```

工厂模式的优势：

*   易于扩展：只需开发附加类并更新工厂即可添加新的交付类型，而无需更改核心代码。

*   逻辑分离：计费逻辑隔离，管理维护简单。

*   灵活性：工厂可能会根据其他因素返回多种解决方案，从而提高灵活性。

## 使用策略模式进行优化

在我们详细介绍之前，请记住，实现将与 Factory 类似，但使用目的会略有不同。

```java
public interface ShippingCostStrategy {
    double calculate(double weight);
}
```

```java
public class StandardShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 5.0;
    }
}

public class ExpressShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 10.0;
    }
}

public class SameDayShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 20.0;
    }
}

public class InternationalShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 50.0;
    }
}

public class OvernightShipping implements ShippingCostStrategy {
    @Override
    public double calculate(double weight) {
        return weight * 30.0;
    }
}
```

现在，我们将创建 ShippingContext 来管理策略

```java
public class ShippingCostContext {
    private ShippingCostStrategy strategy;

    public void setStrategy(ShippingCostStrategy strategy) {
        this.strategy = strategy;
    }

    public double calculateShippingCost(double weight) {
        return strategy.calculate(weight);
    }
}
```

```java
import java.util.HashMap;
import java.util.Map;

public class ShippingCostCalculator {

    private static final Map<String, ShippingCostStrategy> strategies = new HashMap<>();

    static {
        strategies.put("STANDARD", new StandardShipping());
        strategies.put("EXPRESS", new ExpressShipping());
        strategies.put("SAME_DAY", new SameDayShipping());
        strategies.put("INTERNATIONAL", new InternationalShipping());
        strategies.put("OVERNIGHT", new OvernightShipping());
    }

    private final ShippingCostContext context = new ShippingCostContext();

    public double calculateShippingCost(String shippingType, double weight) {
        ShippingCostStrategy strategy = strategies.get(shippingType);
        if (strategy == null) {
            throw new IllegalArgumentException("Invalid shipping type: " + shippingType);
        }
        context.setStrategy(strategy);
        return context.calculateShippingCost(weight);
    }
}
```

现在，将其添加到主类中以供使用。

```java
public class MainCost {

    public static void main(String[] args) 
        ShippingCostCalculator calculator = new ShippingCostCalculator();

        double weight = 10.0;

        String shippingType1 = "STANDARD";
        double cost1 = calculator.calculateShippingCost(shippingType1, weight);
        System.out.println("Shipping cost for " + shippingType1 + ": " + cost1);

        String shippingType2 = "EXPRESS";
        double cost2 = calculator.calculateShippingCost(shippingType2, weight);
        System.out.println("Shipping cost for " + shippingType2 + ": " + cost2);

        String shippingType3 = "SAME_DAY";
        double cost3 = calculator.calculateShippingCost(shippingType3, weight);
        System.out.println("Shipping cost for " + shippingType3 + ": " + cost3);

        String shippingType4 = "INTERNATIONAL";
        double cost4 = calculator.calculateShippingCost(shippingType4, weight);
        System.out.println("Shipping cost for " + shippingType4 + ": " + cost4);

        String shippingType5 = "OVERNIGHT";
        double cost5 = calculator.calculateShippingCost(shippingType5, weight);
        System.out.println("Shipping cost for " + shippingType5 + ": " + cost5);
    }

}

// output
// Shipping cost for STANDARD: 50.0
// Shipping cost for EXPRESS: 100.0
// Shipping cost for SAME_DAY: 200.0
// Shipping cost for INTERNATIONAL: 500.0
// Shipping cost for OVERNIGHT: 300.0
```

在前两种情况下，策略模式管理如何计算运输成本，工厂模式根据交付类型决定使用哪种策略。

## 使用 Stream API 和 Map 进行优化

Lambda 表达式可以简化您的代码，尤其是在处理小型、单一方法接口时。

```java
public class ShippingCostCalculator {

	private static final Map<String, Double> shippingCosts = new HashMap<>();

	static {
		shippingCosts.put("STANDARD", 5.0);
		shippingCosts.put("EXPRESS", 10.0);
		shippingCosts.put("SAME_DAY", 20.0);
		shippingCosts.put("INTERNATIONAL", 50.0);
		shippingCosts.put("OVERNIGHT", 30.0);
	}

	public double calculateShippingCost(String shippingType, double weight) {
		return shippingCosts.entrySet().stream()
				.filter(entry -> entry.getKey().equalsIgnoreCase(shippingType))
				.map(entry -> entry.getValue())
				.findFirst()
				.orElse(0.0)
				* weight;
	}

	public static void main(String[] args) {
		ShippingCostCalculator calculator = new ShippingCostCalculator();

		double weight = 10.0;

		String shippingType1 = "STANDARD";
		double cost1 = calculator.calculateShippingCost(shippingType1, weight);
		System.out.println("Shipping cost for " + shippingType1 + ": " + cost1);

		String shippingType2 = "EXPRESS";
		double cost2 = calculator.calculateShippingCost(shippingType2, weight);
		System.out.println("Shipping cost for " + shippingType2 + ": " + cost2);

		String shippingType3 = "SAME_DAY";
		double cost3 = calculator.calculateShippingCost(shippingType3, weight);
		System.out.println("Shipping cost for " + shippingType3 + ": " + cost3);

		String shippingType4 = "INTERNATIONAL";
		double cost4 = calculator.calculateShippingCost(shippingType4, weight);
		System.out.println("Shipping cost for " + shippingType4 + ": " + cost4);

		String shippingType5 = "OVERNIGHT";
		double cost5 = calculator.calculateShippingCost(shippingType5, weight);
		System.out.println("Shipping cost for " + shippingType5 + ": " + cost5);

		String invalidType = "INVALID";
		double invalidCost = calculator.calculateShippingCost(invalidType, weight);
		System.out.println("Shipping cost for " + invalidType + ": " + invalidCost);
	}
}

// output:
// Shipping cost for STANDARD: 50.0
// Shipping cost for EXPRESS: 100.0
// Shipping cost for SAME_DAY: 200.0
// Shipping cost for INTERNATIONAL: 500.0
// Shipping cost for OVERNIGHT: 300.0
// Shipping cost for INVALID: 0.0
```

这个策略也很方便；虽然扩展性不如Factory和Strategy，但对于简单场景来说它仍然是一个可行的选择。

## 保护子句

思路其实就是，**让出错的代码先返回，前面把所有的错误判断全判断掉，然后就剩下的就是正常的代码了**。

**示例：用户验证**

不要嵌套 if-else 语句来验证用户输入，而是使用 guard 子句来预先处理无效情况：

```java
public class UserService {
    public void registerUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null");
        }
        if (user.getName() == null || user.getName().isEmpty()) {
            throw new IllegalArgumentException("User name cannot be empty");
        }
        if (user.getEmail() == null || user.getEmail().isEmpty()) {
            throw new IllegalArgumentException("User email cannot be empty");
        }
        // Proceed with registration
        System.out.println("Registering user: " + user.getName());
    }
}
```

这种方法可以确保及早处理无效条件，使主要逻辑保持清晰。

## 抽取成函数

有人说：“如果代码不共享，就不要抽取成函数！”，持有这个观点的人太死读书了。函数是代码的封装或是抽象，并不一定用来作代码共享使用，函数用于屏蔽细节，让其它代码耦合于接口而不是细节实现，这会让我们的代码更为简单，简单的东西都能让人易读也易维护。这才是函数的作用。
