const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// MTH-111 Questions - Part A (100 questions) and Part B (50 questions)
// 60% will be year 2026, 40% will be year 2025

const questions = [
  // SECTION 1: LIMITS (Q1-25)
  { q: "What is the limit of a constant function f(x) = k as x approaches any value a?", a: "k", b: "0", c: "Undefined", d: "Infinity", ans: 0, exp: "The limit of any constant function is the constant itself. lim(x→a) k = k, regardless of the value of a." },
  { q: "Evaluate: lim(x→2) (x² − 4x + 2)", a: "−2", b: "2", c: "0", d: "4", ans: 0, exp: "Substitute x = 2: 2² − 4(2) + 2 = 4 − 8 + 2 = −2." },
  { q: "What is lim(x→∞) (5x² − 1)/(2x² + 1)?", a: "5/2", b: "1/2", c: "2/5", d: "Infinity", ans: 0, exp: "Divide numerator and denominator by x²: (5 − 1/x²)/(2 + 1/x²) → 5/2 as x → ∞." },
  { q: "What is lim(x→1) (x³ − 1)/(x − 1)?", a: "3", b: "1", c: "0", d: "Undefined", ans: 0, exp: "Factor: (x³−1)/(x−1) = x² + x + 1. At x = 1: 1 + 1 + 1 = 3." },
  { q: "The formal definition of a limit uses which two Greek letters to denote precision?", a: "ε (epsilon) and δ (delta)", b: "α and β", c: "μ and σ", d: "π and θ", ans: 0, exp: "The epsilon-delta definition states: for all ε > 0, there exists δ > 0 such that |f(x) − L| ≤ ε whenever 0 ≤ |x − c| ≤ δ." },
  { q: "lim(x→−1) (x+3)(x²−5) equals:", a: "−8", b: "8", c: "−4", d: "4", ans: 0, exp: "Evaluate each factor at x = −1: (−1+3) = 2 and ((−1)²−5) = −4. Product = 2 × (−4) = −8." },
  { q: "What is lim(x→∞) 3x/(x + 1)?", a: "3", b: "1", c: "0", d: "Infinity", ans: 0, exp: "Divide by x: 3/(1 + 1/x) → 3/1 = 3 as x → ∞." },
  { q: "For lim(x→a) f(x)·g(x), which rule applies when both limits exist?", a: "Product of individual limits", b: "Sum of individual limits", c: "Quotient of individual limits", d: "None of the above", ans: 0, exp: "The limit of a product equals the product of the limits: lim[f(x)·g(x)] = lim f(x) · lim g(x)." },
  { q: "lim(x→3) √(9 − x²)/(4 − √(x² + 7)) after rationalization equals:", a: "8", b: "4", c: "6", d: "2", ans: 0, exp: "Rationalizing gives (9−x²)(4+√(x²+7))/(9−x²) = 4+√(x²+7). At x = 3: 4 + √16 = 4 + 4 = 8." },
  { q: "What is lim(x→∞) (2x³ − 7x + 3)/(x³ + 2)?", a: "2", b: "3", c: "7", d: "0", ans: 0, exp: "Divide by x³: (2 − 7/x² + 3/x³)/(1 + 2/x³) → 2/1 = 2 as x → ∞." },
  { q: "Which of these represents the limit of a rational function f(x) = g(x)/h(x)?", a: "lim g(x)/lim h(x) when lim h(x) ≠ 0", b: "lim g(x) × lim h(x)", c: "lim g(x) − lim h(x)", d: "lim g(x) + lim h(x)", ans: 0, exp: "For rational functions, lim[g(x)/h(x)] = lim g(x)/lim h(x), provided the denominator limit is not zero." },
  { q: "What does lim(x→∞) (1/x) equal?", a: "0", b: "1", c: "Infinity", d: "Undefined", ans: 0, exp: "As x grows without bound, 1/x approaches 0." },
  { q: "lim(x→1) (x² + 4x + 2) equals:", a: "7", b: "5", c: "3", d: "1", ans: 0, exp: "Substitute x = 1: 1 + 4 + 2 = 7." },
  { q: "What is a 'limit point' in the context of limit definitions?", a: "A value that the function approaches but may not reach", b: "The maximum of a function", c: "A discontinuity in f(x)", d: "The value where f(x) = 0", ans: 0, exp: "A limit point (accumulation point) is a value that the input x approaches; f(x) may or may not equal L at that point." },
  { q: "lim(x→−2) (x² + x + 3) equals:", a: "5", b: "3", c: "7", d: "1", ans: 0, exp: "Substitute x = −2: 4 − 2 + 3 = 5." },
  { q: "What is the limit of f(x) = x as x → 5?", a: "5", b: "0", c: "1", d: "25", ans: 0, exp: "The identity function f(x) = x has limit equal to the approached value: lim(x→5) x = 5." },
  { q: "For lim(x→a) [f(x) + g(x)], if both limits exist, the result is:", a: "lim f(x) + lim g(x)", b: "lim f(x) × lim g(x)", c: "[lim f(x)]²", d: "lim f(x) − lim g(x)", ans: 0, exp: "The sum rule for limits states the limit of a sum equals the sum of the individual limits." },
  { q: "What does 'lim(x→∞) f(x) = L' mean informally?", a: "f(x) approaches L as x grows very large", b: "f(x) equals L when x is infinity", c: "f(L) = x", d: "f is undefined at infinity", ans: 0, exp: "The limit at infinity means f(x) gets arbitrarily close to L as x increases without bound." },
  { q: "lim(x→9) (x² − 81)/(√x − 3) can be evaluated by:", a: "Factoring x² − 81 as (x−9)(x+9)", b: "Rationalizing the denominator only", c: "Substituting x = 9 directly", d: "Setting the limit to zero", ans: 0, exp: "Factor: (x²−81) = (x−9)(x+9). After simplification with denominator (√x−3), the limit can be computed." },
  { q: "Which technique resolves lim(x→a) 0/0 indeterminate forms algebraically?", a: "Factoring and cancelling common factors", b: "Direct substitution", c: "Using the product rule", d: "Rationalization alone", ans: 0, exp: "Factoring the numerator and denominator to cancel the common term that causes the 0/0 form is the primary algebraic technique." },
  { q: "lim(x→2) (x² − 3x + 2)/(x² − 4) after simplification equals:", a: "1/4", b: "1/2", c: "2", d: "0", ans: 0, exp: "Factor: numerator = (x−1)(x−2), denominator = (x−2)(x+2). Cancel (x−2): (x−1)/(x+2) at x = 2 = 1/4." },
  { q: "What happens to lim(x→∞) k/xⁿ where k is constant and n > 0?", a: "The limit is 0", b: "The limit is k", c: "The limit is infinity", d: "The limit is undefined", ans: 0, exp: "As x → ∞, xⁿ grows without bound, so k/xⁿ → 0 for any positive n." },
  { q: "To evaluate lim(x→∞) of a rational function, you divide by:", a: "The highest power of x in the expression", b: "The lowest power of x", c: "The constant term", d: "The numerator", ans: 0, exp: "Dividing numerator and denominator by the highest power of x simplifies the expression, allowing evaluation at infinity." },
  { q: "lim(x→−1) (x² − 7x + 10)/(x² − 4) equals:", a: "(1+7+10)/(1−4) = 18/−3 = −6", b: "−8", c: "0", d: "3", ans: 0, exp: "Substitute x = −1: numerator = 1+7+10 = 18, denominator = 1−4 = −3, result = −6." },
  { q: "Which branch of calculus involves limits to define derivatives and integrals?", a: "Both differential and integral calculus", b: "Only integral calculus", c: "Only differential calculus", d: "Neither", ans: 0, exp: "Limits are foundational to all of calculus — derivatives are defined as limits of average rates of change, and integrals are limits of sums." },
  // SECTION 2: CONTINUITY (Q26-50)
  { q: "A function f(x) is continuous at x = a if f(a) is defined and lim(x→a) f(x) equals:", a: "0", b: "f(a)", c: "a", d: "Infinity", ans: 1, exp: "The third condition for continuity requires lim(x→a) f(x) = f(a) — the limit equals the function's actual value at that point." },
  { q: "Which condition is NOT required for continuity at x = a?", a: "f(a) is well defined", b: "f'(a) exists", c: "lim(x→a) f(x) exists", d: "lim(x→a) f(x) = f(a)", ans: 1, exp: "Continuity does not require differentiability. A function can be continuous at a point without being differentiable there." },
  { q: "The function f(x) = (2x−2)/(x+2) is continuous for all x except:", a: "x = 2", b: "x = −2", c: "x = 0", d: "x = 1", ans: 1, exp: "The denominator x + 2 = 0 when x = −2, so the function is undefined at x = −2 and has a discontinuity there." },
  { q: "If lim(x→−1) f(x) = −1 but f(−1) = 3, then f is:", a: "Continuous at x = −1", b: "Discontinuous at x = −1", c: "Differentiable at x = −1", d: "Undefined at x = −1", ans: 1, exp: "Since lim f(x) ≠ f(−1) (−1 ≠ 3), the third continuity condition fails, making f discontinuous at x = −1." },
  { q: "For continuity, the epsilon-delta requirement is: |f(x) − f(x₀)| < ε whenever:", a: "|x − x₀| > δ", b: "0 < |x − x₀| < δ", c: "|x| < ε", d: "x = x₀", ans: 1, exp: "Continuity at x₀ means: for every ε > 0, there exists δ > 0 such that |f(x) − f(x₀)| < ε whenever 0 < |x − x₀| < δ." },
  { q: "Testing f(x) = (2x²+3x+1)/(x+1) for x≠−1, f(−1) = 3 for continuity: lim(x→−1) f(x) equals:", a: "3", b: "−1", c: "1", d: "0", ans: 1, exp: "Factor: 2x²+3x+1 = (2x+1)(x+1). Cancel (x+1): limit = 2(−1)+1 = −1. Since −1 ≠ 3 = f(−1), it is discontinuous." },
  { q: "A 'small change in input resulting in a small change in output' describes:", a: "Differentiability", b: "Continuity", c: "Limits", d: "Integrability", ans: 1, exp: "This is the informal definition of continuity — a continuous function has no abrupt jumps; small input changes yield small output changes." },
  { q: "f(x) = 4x² + 1 at x = 1 is tested for continuity. lim(x→1) f(x) = ?", a: "1", b: "5", c: "4", d: "2", ans: 1, exp: "Substitute x = 1: 4(1)² + 1 = 5. Since f(1) = 5 = lim, the function is continuous at x = 1." },
  { q: "Which of these functions has a removable discontinuity at x = −1?", a: "f(x) = x + 1", b: "f(x) = (x²+x)/(x+1) for x ≠ −1", c: "f(x) = 1/(x+1)²", d: "f(x) = |x+1|", ans: 1, exp: "f(x) = (x²+x)/(x+1) = x(x+1)/(x+1) = x for x ≠ −1. The discontinuity at x = −1 can be removed by defining f(−1) = −1." },
  { q: "Continuity is essential for the definition of which calculus concept?", a: "Polynomial roots", b: "Derivatives and integrals", c: "Trigonometric identities", d: "Vector cross products", ans: 1, exp: "Both derivatives (using limits) and integrals (using Riemann sums/limits) require the concept of continuity for proper definition." },
  { q: "f(x) = 5x² + x − 2 at x = −2: f(−2) = ?", a: "−4", b: "16", c: "20", d: "0", ans: 1, exp: "f(−2) = 5(4) + (−2) − 2 = 20 − 2 − 2 = 16. This value equals lim(x→−2) f(x), confirming continuity." },
  { q: "Three rules of continuity at x = a are: f(a) defined, lim exists, and:", a: "f'(a) exists", b: "lim(x→a) f(x) = f(a)", c: "f(a) = 0", d: "The function is linear", ans: 1, exp: "The three conditions are: (1) f(a) is defined, (2) the limit exists, and (3) the limit equals f(a)." },
  { q: "If f(x) = x³+1/(x+1) for x≠−1 and f(−1) = 3, what is lim(x→−1) f(x)?", a: "3", b: "(−1)²−(−1)+1 = 3", c: "−3", d: "0", ans: 1, exp: "x³+1 = (x+1)(x²−x+1). Cancelling (x+1): limit = (−1)²−(−1)+1 = 1+1+1 = 3. The function IS continuous here." },
  { q: "A continuous function on a closed interval [a,b] must:", a: "Be differentiable everywhere", b: "Have a maximum and minimum value (Extreme Value Theorem)", c: "Equal zero somewhere", d: "Be a polynomial", ans: 1, exp: "The Extreme Value Theorem guarantees that a continuous function on a closed interval attains both a maximum and minimum value." },
  { q: "What type of discontinuity occurs when lim(x→a⁻) f(x) ≠ lim(x→a⁺) f(x)?", a: "Removable discontinuity", b: "Jump discontinuity", c: "Infinite discontinuity", d: "Oscillating discontinuity", ans: 1, exp: "When left-hand and right-hand limits differ at a point, the discontinuity is classified as a jump discontinuity." },
  { q: "For f(x) = (9−x²)/(4−√(x²+7)) at x=3, the limit value is 8. If f(3) = 8, then f is:", a: "Discontinuous", b: "Continuous", c: "Undefined", d: "Differentiable but not continuous", ans: 1, exp: "Since lim(x→3) f(x) = 8 = f(3), all three continuity conditions are satisfied. The function is continuous at x = 3." },
  { q: "The graph of a continuous function can be drawn:", a: "Only with vertical asymptotes", b: "Without lifting the pen", c: "With gaps at rational x-values", d: "Only for polynomial functions", ans: 1, exp: "Informally, continuity means you can trace the graph without lifting your pen — there are no gaps, holes, or jumps." },
  { q: "f(x) = x² for x ≤ −3 and 6x − 9 for x ≥ 3 — testing at x = 3 requires:", a: "Only the right-hand limit", b: "Checking both pieces and confirming they match", c: "Only the left-hand limit", d: "Finding the derivative", ans: 1, exp: "For piecewise functions, both the left-hand and right-hand limits must be computed and must agree with f(3) for continuity." },
  { q: "A function is said to be continuous on an interval if it is continuous at:", a: "Only the endpoints", b: "Every point within the interval", c: "Only the midpoint", d: "Only discontinuous points", ans: 1, exp: "Continuity on an interval means the function is continuous at every single point within that interval." },
  { q: "Which statement about lim(x→a) f(x) is true for continuity?", a: "The limit must equal zero", b: "The limit must equal f(a)", c: "The limit must be positive", d: "The limit must be finite", ans: 1, exp: "For continuity at x = a, the limit must equal the function's value at that point: lim(x→a) f(x) = f(a)." },
  { q: "The Intermediate Value Theorem applies to:", a: "Discontinuous functions", b: "Continuous functions on a closed interval", c: "Differentiable functions only", d: "Polynomial functions only", ans: 1, exp: "IVT: if f is continuous on [a,b] and N is between f(a) and f(b), then there exists c in (a,b) with f(c) = N." },
  { q: "If f(a) is undefined, then f is:", a: "Differentiable at a", b: "Discontinuous at a", c: "Continuous at a", d: "Integrable at a", ans: 1, exp: "For a function to be continuous at x = a, f(a) must be defined. If undefined, continuity fails immediately." },
  { q: "A function f(x) = 1/x has what type of discontinuity at x = 0?", a: "Removable", b: "Infinite (essential)", c: "Jump", d: "None", ans: 1, exp: "At x = 0, 1/x → ±∞ (depending on direction), so x = 0 is an infinite or essential discontinuity." },
  { q: "To test f(x) at x = a, which step is performed FIRST?", a: "Differentiate f", b: "Check if f(a) is defined", c: "Take lim(x→∞)", d: "Graph the function", ans: 1, exp: "The first step in testing continuity is to determine whether f(a) is actually defined (i.e., a is in the domain of f)." },
  { q: "Continuity and differentiability are related: a differentiable function is always:", a: "Bounded", b: "Continuous", c: "Constant", d: "Periodic", ans: 1, exp: "Differentiability implies continuity: if f is differentiable at a point, it must also be continuous there. The converse is not necessarily true." },
  // SECTION 3: DIFFERENTIATION (Q51-75)
  { q: "The derivative f'(x) is defined as:", a: "f(x+δx) − f(x)", b: "lim(δx→0) f(x+δx)/f(x)", c: "lim(δx→0) [f(x+δx) − f(x)]/δx", d: "f(x)/δx", ans: 2, exp: "The formal definition: f'(x) = lim(δx→0) [f(x+δx) − f(x)]/δx. This is the instantaneous rate of change." },
  { q: "Using the first principle, the derivative of y = x + 2 is:", a: "x", b: "2", c: "1", d: "x + 2", ans: 2, exp: "δy = (x+δx+2) − (x+2) = δx. Divide by δx: 1. Limit as δx→0 gives dy/dx = 1." },
  { q: "The derivative of y = x² by first principle is:", a: "x", b: "x²", c: "2x", d: "2x + δx", ans: 2, exp: "Expand (x+δx)² = x²+2xδx+(δx)². Subtract x², divide by δx: 2x+δx. Limit → 2x." },
  { q: "Differentiating y = 5x³ + x² gives:", a: "5x² + x", b: "10x + 2", c: "15x² + 2x", d: "5x³ + 2x", ans: 2, exp: "Apply power rule: d/dx(5x³) = 15x², d/dx(x²) = 2x. Total: 15x² + 2x." },
  { q: "The derivative of a constant function y = c is:", a: "c", b: "1", c: "0", d: "x", ans: 2, exp: "The graph of y = c is a horizontal line with slope 0. Formally, [c−c]/δx = 0." },
  { q: "d/dx(axⁿ) = ?", a: "axⁿ", b: "nxⁿ⁻¹", c: "anxⁿ⁻¹", d: "ax(n−1)", ans: 2, exp: "Power rule: d/dx(axⁿ) = a·n·xⁿ⁻¹. Multiply the coefficient by the exponent and reduce the exponent by 1." },
  { q: "First principle differentiation is also called:", a: "Partial differentiation", b: "Chain rule", c: "Delta method", d: "Integration by parts", ans: 2, exp: "First principle differentiation is also known as the Delta Method (δ-method), using δx increments to find the derivative." },
  { q: "The derivative of y = 5x² using first principle gives:", a: "5x", b: "10x²", c: "10x", d: "25x", ans: 2, exp: "Expand 5(x+δx)² = 5x²+10xδx+5(δx)². After subtraction and division by δx: 10x + 5δx → 10x." },
  { q: "The derivative represents the slope of:", a: "A secant line", b: "A normal line", c: "The tangent line at a point", d: "A chord", ans: 2, exp: "Geometrically, the derivative at a point is the slope of the tangent line to the curve at that specific point." },
  { q: "Find dy/dx for y = 4x³ − x²:", a: "12x − 2", b: "4x² − 2x", c: "12x² − 2x", d: "4x³ − 2x", ans: 2, exp: "d/dx(4x³) = 12x², d/dx(−x²) = −2x. Therefore dy/dx = 12x² − 2x." },
  { q: "For y = x², the derivative 2x represents:", a: "The area under the curve", b: "The average value", c: "The instantaneous rate of change", d: "The second derivative", ans: 2, exp: "f'(x) = 2x is the instantaneous rate of change of x² at any point x — the slope of the tangent at that x-value." },
  { q: "The identity function V(u) = u has derivative:", a: "u", b: "0", c: "1", d: "2u", ans: 2, exp: "δV = δu after subtracting V(u). Dividing by δu gives 1. The derivative of the identity function is always 1." },
  { q: "In first principle: after expanding f(x+δx) and subtracting f(x), what is the next step?", a: "Take the limit immediately", b: "Square the result", c: "Divide by δx", d: "Multiply by δx", ans: 2, exp: "After finding δy = f(x+δx)−f(x), you must divide both sides by δx to form the average rate of change before taking the limit." },
  { q: "What does d/dx (x⁵) equal?", a: "x⁴", b: "4x⁴", c: "5x⁴", d: "5x⁵", ans: 2, exp: "Power rule: d/dx(xⁿ) = nxⁿ⁻¹. So d/dx(x⁵) = 5x⁴." },
  { q: "dy/dx = lim(δx→0) δy/δx means:", a: "The sum of changes", b: "The product of increments", c: "The instantaneous rate of change of y with respect to x", d: "The average change over time", ans: 2, exp: "This is the fundamental definition of the derivative as a limit — the instantaneous rate of change of y with respect to x." },
  { q: "For f(x) = 5x⁵ + x³, f'(x) = ?", a: "5x⁴ + x²", b: "25x⁴ + x²", c: "25x⁴ + 3x²", d: "10x⁵ + 3x³", ans: 2, exp: "d/dx(5x⁵) = 25x⁴, d/dx(x³) = 3x². Therefore f'(x) = 25x⁴ + 3x²." },
  { q: "The Binomial theorem is used in first principle differentiation when expanding:", a: "f(x)/f(x+δx)", b: "f(x) − f(x+δx)", c: "(x + δx)ⁿ", d: "(x · δx)ⁿ", ans: 2, exp: "When deriving the power rule from first principle, (x+δx)ⁿ is expanded using the Binomial theorem." },
  { q: "The term 'slope' is synonymous with:", a: "Integral", b: "Limit at infinity", c: "Derivative of a function", d: "Constant value", ans: 2, exp: "The slope of a curve at a point is exactly the derivative at that point — they are the same concept expressed differently." },
  { q: "What does 'differentiate a function' mean?", a: "Integrate the function", b: "Find the limit at infinity", c: "Find the derivative of the function", d: "Evaluate the function at a point", ans: 2, exp: "'Differentiate' simply means to find the derivative. The instruction 'differentiate f(x)' = 'find f'(x)'." },
  { q: "The second term that vanishes when δx → 0 in the derivative of x² is:", a: "2x", b: "x²", c: "δx (from 2x + δx)", d: "x", ans: 2, exp: "After dividing: δy/δx = 2x + δx. As δx → 0, the term δx vanishes, leaving dy/dx = 2x." },
  { q: "Which of these correctly applies the power rule to y = (2x)^(−1/2)?", a: "−x^(−3/2)", b: "x^(1/2)", c: "−(1/2)(2x)^(−3/2) · 2 = −(2x)^(−3/2)", d: "(2x)^(1/2)", ans: 2, exp: "Using chain rule + power rule: d/dx[(2x)^(−1/2)] = −(1/2)(2x)^(−3/2) · 2 = −(2x)^(−3/2)." },
  { q: "In d/dx(axⁿ) = anxⁿ⁻¹, what happens to the original exponent n?", a: "It becomes n+1", b: "It stays n", c: "It becomes n−1 (reduced by 1)", d: "It becomes n²", ans: 2, exp: "The power rule reduces the exponent by 1: the original xⁿ becomes xⁿ⁻¹ in the derivative." },
  { q: "f'(x) = 0 for a constant function because:", a: "The function equals x", b: "The limit diverges", c: "The slope of a horizontal line is zero", d: "The function is undefined", ans: 2, exp: "A constant function has a horizontal graph (zero slope). Formally, [c − c]/δx = 0, so the derivative is 0." },
  { q: "If Cassava production is x and Garri production is f(x), then f'(x) represents:", a: "Total Garri produced", b: "Average Cassava input", c: "Rate of change of Garri with respect to Cassava", d: "Maximum production level", ans: 2, exp: "The derivative models real-world rate of change — here, how Garri production changes with Cassava input." },
  { q: "What is δy when y = f(x) and x changes to x + δx?", a: "f(x + δx)", b: "f(δx)", c: "f(x + δx) − f(x)", d: "f(x) · δx", ans: 2, exp: "The change in y is δy = f(x + δx) − f(x) — the new value minus the original value of the function." },
  // SECTION 4: INTEGRATION (Q76-100)
  { q: "Integration is the reverse operation of:", a: "Limits", b: "Continuity", c: "Functions", d: "Differentiation", ans: 3, exp: "Integration (antidifferentiation) reverses differentiation. If F'(x) = f(x), then ∫f(x)dx = F(x) + C." },
  { q: "The symbol for integration is:", a: "Σ", b: "Δ", c: "∂", d: "∫", ans: 3, exp: "The integral sign ∫ is used to denote integration. It was introduced by Leibniz from the Latin word 'summa'." },
  { q: "∫xⁿ dx = ? (n ≠ −1)", a: "nxⁿ⁻¹", b: "xⁿ⁺¹", c: "nxⁿ⁺¹", d: "xⁿ⁺¹/(n+1) + C", ans: 3, exp: "Power rule for integration: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C. Increase the exponent by 1 and divide by the new exponent." },
  { q: "A definite integral ∫[a to b] f(x)dx represents:", a: "The derivative at b", b: "The maximum of f", c: "The limit of f at a", d: "The net area under f(x) from a to b", ans: 3, exp: "A definite integral gives the net area between the curve and the x-axis between the limits a and b." },
  { q: "The constant of integration C is included in indefinite integrals because:", a: "The function might be complex", b: "Integration requires a constant", c: "The answer is always zero", d: "Differentiation of any constant yields zero", ans: 3, exp: "Since d/dx(C) = 0, any constant C disappears during differentiation. When reversing (integrating), we must account for this unknown constant." },
  { q: "∫k dx where k is a constant equals:", a: "0", b: "k²", c: "k/x", d: "kx + C", ans: 3, exp: "∫k dx = kx + C. Think of k as k·x⁰; applying the power rule: k·x¹/1 + C = kx + C." },
  { q: "The Trapezium rule is used for:", a: "Finding exact derivatives", b: "Testing continuity", c: "Computing limits at infinity", d: "Approximate numerical integration", ans: 3, exp: "The Trapezium (Trapezoid) rule approximates a definite integral by dividing the area into trapezoids and summing their areas." },
  { q: "Simpson's rule is more accurate than the Trapezium rule because:", a: "It uses fewer intervals", b: "It ignores end points", c: "It uses discontinuous functions", d: "It approximates curves with parabolas rather than straight lines", ans: 3, exp: "Simpson's rule fits parabolic arcs (quadratic polynomials) to successive pairs of intervals, giving higher accuracy than the linear trapezium approximation." },
  { q: "∫2x dx = ?", a: "2", b: "x²", c: "2x²", d: "x² + C", ans: 3, exp: "∫2x dx = 2·x²/2 + C = x² + C. Verify by differentiating: d/dx(x²+C) = 2x. ✓" },
  { q: "To find the area between a curve and the x-axis from x = a to x = b, you use:", a: "d/dx f(x)", b: "lim(x→a) f(x)", c: "f(a) − f(b)", d: "∫[a to b] f(x) dx", ans: 3, exp: "The definite integral ∫[a to b] f(x) dx gives the area (net) between the curve f(x) and the x-axis from a to b." },
  { q: "Which method finds volumes of solids of revolution?", a: "First principle differentiation", b: "Epsilon-delta proofs", c: "Product rule", d: "Integration using the disk/shell method", ans: 3, exp: "Volumes of revolution are found by integrating — using disk method: V = π∫[a to b] [f(x)]² dx, or the shell method." },
  { q: "Integral calculus deals with:", a: "Rates of instantaneous change", b: "Slopes of tangent lines", c: "Continuity of functions", d: "Addition of effects of continuously varying quantities", ans: 3, exp: "As stated in the course notes: integral calculus deals with the addition of the effects of continuously varying quantities." },
  { q: "∫(5x² + 3x) dx = ?", a: "10x + 3", b: "5x³ + 3x²", c: "10x² + 3", d: "(5x³/3) + (3x²/2) + C", ans: 3, exp: "Integrate term by term: ∫5x² dx = 5x³/3, ∫3x dx = 3x²/2. Sum: 5x³/3 + 3x²/2 + C." },
  { q: "A reduction formula in integration is used to:", a: "Differentiate trigonometric functions", b: "Evaluate limits", c: "Test continuity", d: "Express ∫xⁿf(x)dx in terms of a lower-power integral", ans: 3, exp: "Reduction formulas reduce the power n in ∫xⁿf(x)dx step by step, eventually reaching a known simple integral." },
  { q: "The Fundamental Theorem of Calculus links:", a: "Limits and continuity", b: "Functions and graphs", c: "Constants and derivatives", d: "Differentiation and integration", ans: 3, exp: "The FTC establishes that differentiation and integration are inverse operations, connecting the two main branches of calculus." },
  { q: "∫[1 to 3] 2x dx = ?", a: "4", b: "6", c: "2", d: "8", ans: 3, exp: "Antiderivative of 2x is x². Evaluate: [3²] − [1²] = 9 − 1 = 8." },
  { q: "Differential calculus deals with:", a: "Areas under curves", b: "Sums of discrete values", c: "Definite integrals", d: "Rates of change", ans: 3, exp: "As stated in the course: differential calculus deals with rates of change, while integral calculus deals with summation of effects." },
  { q: "The volume of a solid of revolution about the x-axis using the disk method is:", a: "2π∫f(x)dx", b: "∫[f(x)]dx", c: "∫f'(x)dx", d: "π∫[a to b] [f(x)]² dx", ans: 3, exp: "Disk method formula: V = π∫[a to b] [f(x)]² dx, where each thin disk has volume π[f(x)]²dx." },
  { q: "Which rule applies when finding ∫[uv] dx involving a product of functions?", a: "Power rule", b: "Chain rule", c: "L'Hôpital's rule", d: "Integration by parts", ans: 3, exp: "Integration by parts: ∫u dv = uv − ∫v du. This handles products of functions in integration." },
  { q: "For approximate integration, the Trapezium rule uses h/2 × [f(x₀)+2f(x₁)+…+f(xₙ)] where h is:", a: "The function value", b: "The limit", c: "The derivative", d: "The step width (b−a)/n", ans: 3, exp: "h = (b−a)/n is the step width — the width of each trapezium in the approximation of the definite integral." },
  { q: "The antiderivative F(x) of f(x) satisfies:", a: "F(x) = lim f(x)", b: "F(x) = f(x)²", c: "F(x) = f'(x)", d: "F'(x) = f(x)", ans: 3, exp: "F(x) is an antiderivative of f(x) if and only if F'(x) = f(x). Integration finds F(x) given f(x)." },
  { q: "∫cos(x) dx = ?", a: "−cos(x) + C", b: "−sin(x) + C", c: "cos(x) + C", d: "sin(x) + C", ans: 3, exp: "The antiderivative of cos(x) is sin(x). Verify: d/dx[sin(x)] = cos(x). So ∫cos(x)dx = sin(x) + C." },
  { q: "In the context of calculus, 'continuously varying quantities' are studied using:", a: "Discrete mathematics", b: "Statistical inference", c: "Algebraic factoring", d: "Both differential and integral calculus", ans: 3, exp: "The course description explicitly states that calculus (both differential and integral) is the branch of mathematics dealing with continuously varying quantities." },
  { q: "Simpson's rule for n = 2 (one pair of intervals) uses the formula:", a: "h[f₀ + fₙ]", b: "h/2[f₀ + 2f₁ + fₙ]", c: "h²[f₀ + f₁]", d: "h/3[f₀ + 4f₁ + f₂]", ans: 3, exp: "Simpson's 1/3 rule: (h/3)[f(x₀) + 4f(x₁) + f(x₂)], using the parabolic fit through three points." },
  { q: "When computing lim(x→∞) f(x)/g(x) where both → 0 or ∞, which rule can be applied?", a: "Product rule", b: "Continuity theorem", c: "Binomial theorem", d: "L'Hôpital's Rule", ans: 3, exp: "L'Hôpital's Rule: for 0/0 or ∞/∞ indeterminate forms, take the limit of f'(x)/g'(x) instead of f(x)/g(x)." },
  // PART B - SECTION A: ANSWERS = A (Q101-110)
  { q: "What is the definition of a function in calculus?", a: "A rule assigning each input exactly one output", b: "A graph that crosses the y-axis once", c: "An equation where every output has one input", d: "A rule where inputs can have multiple outputs", ans: 0, exp: "A function assigns to every input (independent variable) exactly one output (dependent variable). Multiple outputs for a single input would violate the definition." },
  { q: "Which branch of calculus focuses on rates of change?", a: "Differential Calculus", b: "Integral Calculus", c: "Vector Calculus", d: "Tensor Calculus", ans: 0, exp: "Differential Calculus studies how quantities change — it deals with derivatives and rates of change. Integral Calculus deals with accumulation." },
  { q: "Evaluate: lim(x→1) (x² + 4x + 2)", a: "7", b: "6", c: "8", d: "5", ans: 0, exp: "Substitute x = 1 directly: (1)² + 4(1) + 2 = 1 + 4 + 2 = 7." },
  { q: "What technique is used when direct substitution gives 0/0?", a: "Factoring", b: "Rationalization", c: "L'Hôpital's Rule", d: "Graphing", ans: 0, exp: "When substitution yields the indeterminate form 0/0, factoring the numerator (or denominator) to cancel the offending factor is the primary algebraic technique." },
  { q: "In the limit lim(x→1) (x³−1)/(x−1), what do you factor x³−1 as?", a: "(x−1)(x²+x+1)", b: "(x+1)(x²−x+1)", c: "(x−1)(x²−x+1)", d: "(x+1)(x²+x+1)", ans: 0, exp: "The difference of cubes formula: a³−b³=(a−b)(a²+ab+b²). So x³−1=(x−1)(x²+x+1)." },
  { q: "After cancelling (x−1) in lim(x→1)(x³−1)/(x−1), what is the result?", a: "3", b: "2", c: "1", d: "0", ans: 0, exp: "After cancelling, substitute x = 1 into x²+x+1 → 1+1+1 = 3." },
  { q: "What does lim(x→−2)(x²+x+3) equal?", a: "5", b: "4", c: "3", d: "6", ans: 0, exp: "Substitute x = −2: (−2)²+(−2)+3 = 4−2+3 = 5." },
  { q: "What is the symbol for 'approaches infinity'?", a: "x→∞", b: "x=∞", c: "x≥∞", d: "x<∞", ans: 0, exp: "The notation x→∞ means 'as x increases without bound'. The arrow (→) denotes 'approaches'." },
  { q: "What is the independent variable in a function y = f(x)?", a: "x", b: "y", c: "f", d: "Both x and y", ans: 0, exp: "x is the independent variable (input). y is the dependent variable (output), since its value depends on x." },
  { q: "Evaluate: lim(x→2)(x²−4x+2)", a: "−2", b: "0", c: "2", d: "4", ans: 0, exp: "Substitute x = 2: (2)²−4(2)+2 = 4−8+2 = −2." },
  // PART B - SECTION B: ANSWERS = B (Q111-120)
  { q: "What is a limit in calculus?", a: "The maximum value of a function", b: "The value a function approaches as x nears a specific point", c: "The slope of a tangent line", d: "The area under a curve", ans: 1, exp: "A limit describes the value that f(x) gets closer and closer to as x approaches some value c — it does not have to equal f(c)." },
  { q: "To find lim(x→∞) of a rational function, you divide by the _____ power of x.", a: "Smallest", b: "Highest", c: "Middle", d: "Constant", ans: 1, exp: "Dividing all terms by the highest power of x in the denominator reduces each term with x to 0 as x→∞, leaving only the leading coefficients." },
  { q: "Evaluate: lim(x→∞) (5x²−1)/(2x²+1)", a: "1", b: "5/2", c: "5", d: "2/5", ans: 1, exp: "Divide by x²: (5−1/x²)/(2+1/x²) → (5−0)/(2+0) = 5/2 as x→∞." },
  { q: "Evaluate: lim(x→∞) (3x²−1)/(2x²+1)", a: "1", b: "3/2", c: "3", d: "2/3", ans: 1, exp: "Divide numerator and denominator by x²: (3−1/x²)/(2+1/x²) → (3−0)/(2+0) = 3/2." },
  { q: "Which symbol represents an indeterminate form when substitution is used?", a: "1/0", b: "0/0", c: "∞/1", d: "0/∞", ans: 1, exp: "0/0 is the classic indeterminate form — the limit may still exist but cannot be found by direct substitution. Factoring or other techniques are needed." },
  { q: "What technique is used for limits involving square roots?", a: "Factoring", b: "Rationalization", c: "Direct Substitution", d: "Polynomial Division", ans: 1, exp: "Rationalization — multiplying by the conjugate — eliminates square roots in the numerator or denominator, allowing the limit to be evaluated." },
  { q: "In rationalization, you multiply by the _____ of the expression containing the root.", a: "Inverse", b: "Conjugate", c: "Reciprocal", d: "Derivative", ans: 1, exp: "The conjugate of (a−√b) is (a+√b). Multiplying by the conjugate uses the difference of squares identity to remove the radical." },
  { q: "What is the value of lim(x→∞)(2x²−7x+3)/(x³+2)?", a: "3", b: "0", c: "2", d: "∞", ans: 1, exp: "Divide by x³: numerator → 2/x−7/x²+3/x³ → 0; denominator → 1+2/x³ → 1. Result: 0/1 = 0." },
  { q: "What does 'f(x) approaches L as x approaches c' mean mathematically?", a: "f(c) = L always", b: "lim(x→c) f(x) = L", c: "f(c) is undefined", d: "f is constant near c", ans: 1, exp: "The mathematical statement lim(x→c) f(x) = L formally captures the idea that f(x) gets arbitrarily close to L as x gets close to c." },
  { q: "The two main branches of calculus are Differential Calculus and _____ Calculus.", a: "Algebraic", b: "Integral", c: "Vector", d: "Polynomial", ans: 1, exp: "Calculus is divided into Differential Calculus (rates of change, derivatives) and Integral Calculus (accumulation, areas, antiderivatives)." },
  // PART B - SECTION C: ANSWERS = C (Q121-130)
  { q: "Which variable is called the dependent variable in y = f(x)?", a: "x", b: "f", c: "y", d: "c", ans: 2, exp: "y is the dependent variable because its value depends on the value of x (the independent variable)." },
  { q: "Evaluate: lim(x→0)(x²+3x+5)", a: "0", b: "3", c: "5", d: "8", ans: 2, exp: "Substitute x = 0: (0)²+3(0)+5 = 0+0+5 = 5." },
  { q: "If lim(x→3)(x²−9)/(x−3) is evaluated, what is it equal to?", a: "0", b: "3", c: "6", d: "9", ans: 2, exp: "Factor: x²−9=(x−3)(x+3). Cancel (x−3): lim(x→3)(x+3) = 3+3 = 6." },
  { q: "What is the limit lim(x→∞)(4x³)/(2x³+1)?", a: "4", b: "2", c: "2", d: "1/2", ans: 2, exp: "Divide by x³: 4/(2+1/x³) → 4/2 = 2 as x→∞." },
  { q: "Which of these is NOT a technique for evaluating limits?", a: "Direct Substitution", b: "Factoring", c: "Integration", d: "Rationalization", ans: 2, exp: "Integration is an operation from integral calculus, not a technique for evaluating limits. The three main limit techniques are direct substitution, factoring, and rationalization." },
  { q: "What is the result of lim(x→4)(x²−16)/(x−4)?", a: "0", b: "4", c: "8", d: "16", ans: 2, exp: "Factor x²−16=(x−4)(x+4). Cancel (x−4): lim(x→4)(x+4) = 4+4 = 8." },
  { q: "lim(x→2)(x²−4)/(x−2) = ?", a: "0", b: "2", c: "4", d: "6", ans: 2, exp: "Factor: x²−4=(x−2)(x+2). Cancel (x−2): lim(x→2)(x+2) = 2+2 = 4." },
  { q: "In the notation lim(x→c) f(x), the letter c represents?", a: "The output value", b: "The slope", c: "The value x is approaching", d: "A constant function", ans: 2, exp: "In limit notation, c is the specific value that x is approaching (the point of approach), not necessarily the value of f at that point." },
  { q: "What is lim(x→∞)(7x+1)/(7x−1)?", a: "0", b: "−1", c: "1", d: "7", ans: 2, exp: "Divide by x: (7+1/x)/(7−1/x) → (7+0)/(7−0) = 7/7 = 1 as x→∞." },
  { q: "What does the notation f: A→B indicate about a function?", a: "f maps from B to A", b: "f maps to A from B", c: "f maps from set A to set B", d: "A and B are equal sets", ans: 2, exp: "The notation f: A→B means f is a function that maps elements from the domain set A to the codomain set B." },
  // PART B - SECTION D: ANSWERS = D (Q131-150)
  { q: "The study of accumulation of quantities belongs to which branch of calculus?", a: "Differential Calculus", b: "Algebraic Calculus", c: "Vector Calculus", d: "Integral Calculus", ans: 3, exp: "Integral Calculus deals with accumulation of quantities — finding areas under curves, total change, and antiderivatives." },
  { q: "What is 1/x² as x→∞?", a: "∞", b: "1", c: "−∞", d: "0", ans: 3, exp: "As x grows without bound, 1/x² = 1/(very large number) approaches 0. This is the key fact used in evaluating rational limits at infinity." },
  { q: "Direct substitution means you _____ the value of x into the function.", a: "Differentiate", b: "Factor out", c: "Graph", d: "Plug in", ans: 3, exp: "Direct substitution (also called 'plugging in') simply replaces x with the value c and computes the result, provided the function is defined there." },
  { q: "lim(x→5)(x²−25)/(x−5) = ?", a: "0", b: "5", c: "−10", d: "10", ans: 3, exp: "Factor: x²−25=(x−5)(x+5). Cancel (x−5): lim(x→5)(x+5) = 5+5 = 10." },
  { q: "What is the conjugate of (3 − √x)?", a: "(3 + x)", b: "(−3 − √x)", c: "(√x − 3)", d: "(3 + √x)", ans: 3, exp: "The conjugate of a binomial (a−b) is (a+b). So the conjugate of (3−√x) is (3+√x)." },
  { q: "lim(x→∞)(2x³+5)/(x³−1) = ?", a: "5", b: "−5", c: "1", d: "2", ans: 3, exp: "Divide by x³: (2+5/x³)/(1−1/x³) → (2+0)/(1−0) = 2 as x→∞." },
  { q: "What is calculus fundamentally the study of?", a: "Algebraic equations", b: "Geometric shapes", c: "Statistical data", d: "Continuous change", ans: 3, exp: "Calculus is defined as the mathematical study of continuous change. It provides tools to analyse how quantities change and accumulate." },
  { q: "If lim(x→c) f(x) = L and lim(x→c) g(x) = M, then lim(x→c)[f(x)+g(x)] = ?", a: "L × M", b: "L − M", c: "M − L", d: "L + M", ans: 3, exp: "By the Sum Law of Limits: lim[f(x)+g(x)] = lim f(x) + lim g(x) = L + M." },
  { q: "lim(x→0)(sin x)/x = ?", a: "0", b: "∞", c: "sin(0)", d: "1", ans: 3, exp: "The special limit lim(x→0)(sin x)/x = 1 is a fundamental result in calculus, proven using squeeze theorem or geometric arguments." },
  { q: "What type of form is ∞/∞?", a: "A defined form", b: "A zero form", c: "A negative form", d: "An indeterminate form", ans: 3, exp: "∞/∞ is an indeterminate form — just like 0/0, the limit cannot be determined from the form alone; further analysis is required." },
  { q: "Evaluate: lim(x→3)(x²−9)/(x²−6x+9)", a: "0", b: "3", c: "1", d: "Does not exist (simplifies to 6/0)", ans: 3, exp: "x²−9=(x−3)(x+3); x²−6x+9=(x−3)². After cancelling one (x−3): (x+3)/(x−3). As x→3: 6/0 → the limit does not exist (vertical asymptote)." },
  { q: "What happens to 7/x as x→∞?", a: "It equals 7", b: "It equals ∞", c: "It equals −7", d: "It approaches 0", ans: 3, exp: "As x→∞, the denominator grows without bound, so 7/x → 0. Constants divided by x always approach 0 at infinity." },
  { q: "Which of the following best describes the domain of a function?", a: "All possible output values", b: "The y-intercept", c: "The range values", d: "The set of all valid input values", ans: 3, exp: "The domain of a function is the complete set of valid input values (values of x) for which the function is defined and produces a real output." },
  { q: "lim(x→∞)(x²+1)/(x²−1) = ?", a: "0", b: "−1", c: "∞", d: "1", ans: 3, exp: "Divide by x²: (1+1/x²)/(1−1/x²) → (1+0)/(1−0) = 1." },
  { q: "What is the range of a function?", a: "All input values", b: "The x-intercepts", c: "The horizontal asymptote", d: "All possible output values", ans: 3, exp: "The range is the complete set of all possible output values (y values) that the function can produce from its domain." },
  { q: "Which notation correctly expresses 'limit of f(x) as x approaches 2 is 5'?", a: "f(2) = lim 5", b: "lim f = 2x", c: "2 → f(x) = 5", d: "lim(x→2) f(x) = 5", ans: 3, exp: "The correct limit notation is lim(x→2) f(x) = 5, using the arrow below 'lim' to show the value x is approaching." },
  { q: "What is lim(x→1)(x²−1)/(x−1)?", a: "0", b: "1", c: "3", d: "2", ans: 3, exp: "Factor: x²−1=(x−1)(x+1). Cancel (x−1): lim(x→1)(x+1) = 1+1 = 2." },
  { q: "For lim(x→∞)(ax²+b)/(cx²+d), the limit equals?", a: "b/d", b: "0", c: "c/a", d: "a/c", ans: 3, exp: "Dividing by x², both the constant terms vanish, leaving leading coefficients only: lim = a/c. This is why only the highest-degree terms matter at infinity." },
  { q: "lim(x→−1)(x²+3x+2)/(x+1) = ?", a: "2", b: "0", c: "−2", d: "1", ans: 3, exp: "Factor numerator: x²+3x+2=(x+1)(x+2). Cancel (x+1): lim(x→−1)(x+2) = −1+2 = 1." },
  { q: "Which statement about limits is TRUE?", a: "A limit always equals f(c)", b: "A limit only exists if f(c) is defined", c: "A limit cannot be 0", d: "A limit describes the value f(x) approaches, not necessarily f(c)", ans: 3, exp: "A limit describes what f(x) approaches as x→c, which may differ from f(c) or exist even when f(c) is undefined. This is the essential concept of a limit." },
];

async function main() {
  console.log('Starting MTH-111 question upload...');
  
  // Find the MTH-111 subject (calculus)
  const subject = await prisma.subject.findFirst({
    where: { label: 'MTH-111' }
  });
  
  if (!subject) {
    console.log('MTH-111 subject not found. Creating it...');
    const newSubject = await prisma.subject.create({
      data: {
        label: 'MTH-111',
        description: 'Calculus I: Limits, Continuity, Differentiation, and Integration'
      }
    });
    console.log('Created subject:', newSubject.id);
    subjectId = newSubject.id;
  } else {
    console.log('Found subject:', subject.id);
    subjectId = subject.id;
  }
  
  // Delete existing questions for this subject
  const deleted = await prisma.question.deleteMany({
    where: { subjectId }
  });
  console.log(`Deleted ${deleted.count} existing questions`);
  
  // Calculate year distribution: 60% 2026, 40% 2025
  const totalQuestions = questions.length;
  const year2026Count = Math.round(totalQuestions * 0.6);
  
  console.log(`Uploading ${totalQuestions} questions...`);
  console.log(`Year distribution: ${year2026Count} for 2026, ${totalQuestions - year2026Count} for 2025`);
  
  // Upload questions in batches
  const batchSize = 20;
  let uploaded = 0;
  
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    
    for (let j = 0; j < batch.length; j++) {
      const q = batch[j];
      const questionIndex = i + j;
      const year = questionIndex < year2026Count ? 2026 : 2025;
      
      await prisma.question.create({
        data: {
          subjectId,
          question: q.q,
          optionA: q.a,
          optionB: q.b,
          optionC: q.c,
          optionD: q.d,
          answerIndex: q.ans,
          difficulty: 'medium',
          year,
          explanation: q.exp
        }
      });
      uploaded++;
    }
    
    console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalQuestions / batchSize)} (${uploaded}/${totalQuestions} questions)`);
  }
  
  console.log(`\n✅ Successfully uploaded ${uploaded} MTH-111 questions!`);
  console.log(`   - ${year2026Count} questions for year 2026 (60%)`);
  console.log(`   - ${totalQuestions - year2026Count} questions for year 2025 (40%)`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
