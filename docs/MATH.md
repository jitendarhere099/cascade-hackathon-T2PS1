# Mathematical Foundations: Firstlight

### Formal Mathematical Specification of the Meridian Online Crisis-Prediction & Decision Engine

---

## 1. Latent State Space & Transition Dynamics

In Firstlight, the municipal state at minute $t$ is represented by a set of $N = 4000$ particles:
$$\mathcal{S}_t = \{ s_t^{(i)}, w_t^{(i)} \}_{i=1}^N, \quad \sum_{i=1}^N w_t^{(i)} = 1$$
Each particle $s_t^{(i)}$ is a tuple:
$$s_t^{(i)} = \Big( H_t^{(i)}, \tau_{\text{onset}}^{(i)}, d_{\text{epi}}^{(i)}, \text{rain}_t^{(i)}, \text{flu}_t^{(i)}, \text{rumor}_t^{(i)}, \{ \text{gw}_k^{(i)} \}_{k=A}^D, \mathbf{f}_t^{(i)} \Big)$$

- $H \in \{ \text{NOISE}, \text{SENSOR\_FAILURE}, \text{ISOLATED}, \text{CASCADE} \}$
- $\tau_{\text{onset}} \in [0, t]$: minute the crisis process began (marginalised by the filter).
- $d_{\text{epi}} \in \{ D_1, \dots, D_6 \}$: district epicenter for localized anomalies.
- $\text{rain} \in \{ 0: \text{none}, 1: \text{moderate}, 2: \text{heavy} \}$
- $\text{flu}, \text{rumor} \in \{0, 1\}$: innocent nuisance explanations.
- $\text{gw}_k \in \{0, 1\}$: indicator of hardware outage for gateway $k \in \{A, B, C, D\}$.
- $\mathbf{f}$: bitmask of faulty sensor hardware groups.

### Transition Hazards
Transitions follow a Markov jump process:
$$P(H_{t+1} = \text{CASCADE} \mid H_t = \text{ISOLATED}) = \lambda_{\text{grow}} = 0.03 \text{ min}^{-1}$$
$$P(H_{t+1} \neq H_t \mid H_t) = \lambda_{\text{switch}} = 0.01 \text{ min}^{-1}$$
Weather nuisance states evolve via a tridiagonal transition matrix:
$$\mathbf{P}_{\text{rain}} = \begin{pmatrix} 0.95 & 0.05 & 0.00 \\ 0.03 & 0.94 & 0.03 \\ 0.00 & 0.04 & 0.96 \end{pmatrix}$$
Causal coupling: under $H = \text{CASCADE}$, reaching the power-substation trip stage raises gateway outage hazard:
$$P(\text{gw}_k = 1 \mid H = \text{CASCADE}, t - \tau_{\text{onset}} \ge 8) = 0.22 \text{ min}^{-1}$$

---

## 2. Emission Likelihoods & Evidence Tempering

For each telemetry channel $c \in \{ \text{drainage}, \text{traffic}, \text{calls}, \text{hospitals}, \text{power}, \text{citizen}, \text{social}, \text{cameras} \}$ and district $d$, observed count $n_{c,d,t}$ has expectation:
$$\mu_c(s) = \lambda_c(s) \cdot r_c + \beta_c \cdot (1 - r_c)$$
where $r_c \in [0, 1]$ is the learned posterior mean trust in channel group $c$, and $\beta_c$ is background noise.

### Negative Binomial Likelihood
To prevent overconfidence from correlated unmodelled micro-bursts, emissions use Negative Binomial (overdispersed Poisson) parameterized by mean $\mu$ and dispersion $k_c$:
$$P(N = n \mid \mu, k_c) = \frac{\Gamma(n + k_c)}{n! \, \Gamma(k_c)} \left( \frac{k_c}{k_c + \mu} \right)^{k_c} \left( \frac{\mu}{k_c + \mu} \right)^n$$
Variance is $\operatorname{Var}(N) = \mu + \frac{\mu^2}{k_c} > \mu$.

### Spatial Concentration
Under $\text{ISOLATED}$, probability mass requires concentration in epicenter district $d_{\text{epi}}$:
$$P(d \mid \text{ISOLATED}) = 0.75 \cdot \mathbb{I}(d = d_{\text{epi}}) + 0.05 \cdot \mathbb{I}(d \neq d_{\text{epi}})$$
Under $\text{CASCADE}$, probability spreads across 3+ districts following arterial transit links.

### Tempering & Epsilon-Contamination Floor
Raw channel log-likelihoods are tempered by exponent $\tau_t \in (0, 1]$:
$$\tau_t = \min\left(1.0, \frac{\text{ESS}_t}{0.5 \cdot N}\right) \cdot \sqrt{\frac{D_{\text{active}}}{6}}$$
where $D_{\text{active}}$ is the count of distinct reporting districts.
Posterior hypothesis probabilities enforce an $\epsilon = 0.005$ contamination floor:
$$P(H) = (1 - 4\epsilon) \cdot \hat{P}(H) + \epsilon, \quad \forall H$$
ensuring no single erroneous packet can drive belief to certainty.

---

## 3. Correlation & Structured Lies

### Effective Independent Sample Size
When $m$ sensors report behind the same gateway or share duplicate payload hashes $h$:
$$N_{\text{eff}} = \sqrt{m}$$
The log-likelihood contribution is scaled:
$$\log P(\text{cluster} \mid s) = \frac{1}{\sqrt{m}} \sum_{j=1}^m \log P(x_j \mid s)$$
preventing 100 sensors behind Gateway GW-B from contributing $100\times$ evidence.

### Common-Cause Detector
Given cluster observations $\{x_j\}_{j=1}^m$, if empirical variance $\sigma^2_x < 0.15 \cdot \sigma^2_{\text{expected}}$:
$$P(\text{SENSOR\_FAILURE}) \leftarrow P(\text{SENSOR\_FAILURE}) + \kappa_{\text{fault}} \cdot (1 - \sigma^2_x / \sigma^2_{\text{exp}})$$

### Rumor Wave Detector
If citizen/social chatter spikes with text-duplication ratio $> 0.65$ without corroboration from physical channels ($\text{drainage} = \text{traffic} = \text{power} = \text{nominal}$):
$$P(\text{rumor} = 1) \uparrow 0.95, \quad P(H = \text{CASCADE} \mid \text{social chatter}) \equiv P(H = \text{CASCADE} \mid \text{prior})$$

---

## 4. Online Calibration & Prefix Bank

Raw particle posteriors $\mathbf{p}_{\text{raw}} = (p_N, p_S, p_I, p_C)$ pass through online temperature scaling conditioned on time bucket $b = \lfloor t / 3 \rfloor$:
$$z_h = \frac{\log p_{h, \text{raw}}}{T_b} + \beta_{h, b}, \quad p_h^{\text{cal}} = \frac{e^{z_h}}{\sum_j e^{z_j}}$$
Fitted online after each resolved episode via stochastic gradient descent on cross-entropy:
$$\mathcal{L} = -\sum_{h} y_h \log p_h^{\text{cal}}$$

### Prefix Bank Kernel Matching
At minutes 3, 5, 7, 10, quantized feature signature $\mathbf{u}_t = (p_N, p_S, p_I, p_C, \text{rain}, \text{gw\_down})$ is matched against stored resolved episodes $\mathcal{B}_t$:
$$p_h^{\text{bank}} = \frac{\sum_{j \in \mathcal{B}_t} K(\mathbf{u}_t, \mathbf{u}_j) \cdot y_{j, h}}{\sum_{j \in \mathcal{B}_t} K(\mathbf{u}_t, \mathbf{u}_j)}$$
Final probability blends parametric and non-parametric estimators:
$$\mathbf{p}_t = (1 - \alpha_B) \mathbf{p}_t^{\text{cal}} + \alpha_B \mathbf{p}_t^{\text{bank}}, \quad \alpha_B = \min\left(0.5, \frac{|\mathcal{B}_t|}{100}\right)$$

---

## 5. Decision Engine & Optimal Stopping

### Cost Matrix & Delay Growth
Under action $a \in \{ \text{WATCH}, \text{PREPARE}, \text{ALERT}, \text{ESCALATE} \}$ and true state $h$:
- **Missed Cascade Damage**:
  $$L(a, \text{CASCADE}, t) = D_0 (1 + g)^t \cdot (1 - \rho(a))$$
  where $D_0 = 100$, $g = 0.12$, and mitigation efficiency $\rho$:
  $$\rho(\text{WATCH}) = 0.00, \quad \rho(\text{PREPARE}) = 0.25, \quad \rho(\text{ALERT}) = 0.60, \quad \rho(\text{ESCALATE}) = 0.85$$
- **False Alarms**:
  $$L(a, h \neq \text{CASCADE}) = C(a) \cdot (1 + \kappa F_t)$$
  $C(\text{PREPARE}) = 1$, $C(\text{ALERT}) = 8$, $C(\text{ESCALATE}) = 40$.
- **Cry-Wolf Fatigue Accumulation**:
  $$F_t = F_{t-1} \cdot e^{-1 / \tau_{\text{fatigue}}} + \mathbb{I}(a_t \in \{\text{ALERT}, \text{ESCALATE}\} \land H \neq \text{CASCADE})$$
  $\kappa = 0.5$, $\tau_{\text{fatigue}} = 30$ min.

### Value of Waiting (Optimal Stopping)
Expected cost of acting immediately:
$$\text{EC}(a) = \sum_{h} p_h L(a, h, t, F_t)$$
For candidate waiting horizons $k \in \{1, 2, 3, 5\}$:
$$\text{EC}_{\text{wait}}(k) = \mathbb{E}_{\mathbf{x}_{t+1:t+k} \sim \mathcal{S}_t} \left[ \min_{a'} \text{EC}(a', t+k) \right]$$
**Decision Rule**:
$$a_t^* = \begin{cases} \arg\min_a \text{EC}(a) & \text{if } \min_a \text{EC}(a) \le \min_k \text{EC}_{\text{wait}}(k) \\ \text{WATCH} & \text{otherwise} \end{cases}$$

### Hysteresis & Minimum Dwell Times
To eliminate alert flip-flopping ($\text{ESCALATE} \to \text{WATCH} \to \text{ESCALATE}$):
1. **Dwell Time**: After escalating, state is locked for at least $3$ minutes ($\text{dwell}_{\text{raise}} = 3$). After lowering, locked for $2$ minutes.
2. **Switching Penalty**: Escalation requires $\text{EC}(a_{\text{new}}) < \text{EC}(a_{\text{curr}}) - 2.0$.
3. **Conservative De-escalation**: Lowering from $\text{ESCALATE}$ requires $P(\text{CASCADE}) < 0.25$ for $M=4$ consecutive minutes.

---

## 6. Online Bayesian Learning

### Source Trust Updates
Reliability $r_c \sim \operatorname{Beta}(\alpha_c, \beta_c)$. With episode discount $\gamma = 0.98$:
$$\alpha_c \leftarrow \gamma (\alpha_c - 1) + 1, \quad \beta_c \leftarrow \gamma (\beta_c - 1) + 1$$
Upon revelation of ground truth $y$:
$$\alpha_c \leftarrow \alpha_c + \sum_{m} \mathbb{I}(x_{c, m} \text{ matches } y), \quad \beta_c \leftarrow \beta_c + \sum_{m} \mathbb{I}(x_{c, m} \text{ contradicts } y)$$
Posterior mean: $\hat{r}_c = \frac{\alpha_c}{\alpha_c + \beta_c}$.

### Base Rate Prior Adaptation & CUSUM Change-Point
Base rates $\boldsymbol{\pi} = (\pi_N, \pi_S, \pi_I, \pi_C) \sim \operatorname{Dirichlet}(\boldsymbol{\alpha})$.
Exponential forgetting with discount $\gamma_{\pi} = 0.95$:
$$\boldsymbol{\alpha} \leftarrow \gamma_{\pi} \boldsymbol{\alpha} + \mathbf{y}_{\text{resolved}}$$
Log-likelihood ratio decision statistic for change-point (Monsoon shift):
$$S_n = \max(0, S_{n-1} + \log \frac{P(y_n \mid \boldsymbol{\pi}_{\text{new}})}{P(y_n \mid \boldsymbol{\pi}_{\text{old}})} - \delta)$$
When $S_n > h_{\text{threshold}} = 4.5$, change-point triggers: learning rate $\alpha$ is tripled for 5 episodes, enabling recovery within 10 episodes.
