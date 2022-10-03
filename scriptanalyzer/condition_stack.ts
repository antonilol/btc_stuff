// From the Bitcoin Core source code, file src/script/interpreter.cpp at commit b1a2021f78099c17360dc2179cbcb948059b5969
// Edited for TypeScript use

// Orignal Bitcoin Core copyright header:
// Copyright (c) 2009-2010 Satoshi Nakamoto
// Copyright (c) 2009-2021 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.

/** A constant for m_first_false_pos to indicate there are no falses. */
const NO_FALSE = -1;

/** A data type to abstract out the condition stack during script execution.
 *
 * Conceptually it acts like a vector of booleans, one for each level of nested
 * IF/THEN/ELSE, indicating whether we're in the active or inactive branch of
 * each.
 *
 * The elements on the stack cannot be observed individually; we only need to
 * expose whether the stack is empty and whether or not any false values are
 * present at all. To implement OP_ELSE, a toggle_top modifier is added, which
 * flips the last value without returning it.
 *
 * This uses an optimized implementation that does not materialize the
 * actual stack. Instead, it just stores the size of the would-be stack,
 * and the position of the first false value in it.
 */
class ConditionStack {
	/** The size of the implied stack. */
	private m_stack_size = 0;
	/** The position of the first false value on the implied stack, or NO_FALSE if all true. */
	private m_first_false_pos = NO_FALSE;

	public empty(): boolean {
		return this.m_stack_size === 0;
	}

	public all_true(): boolean {
		return this.m_first_false_pos === NO_FALSE;
	}

	public push_back(f: boolean): void {
		if (this.m_first_false_pos === NO_FALSE && !f) {
			// The stack consists of all true values, and a false is added.
			// The first false value will appear at the current size.
			this.m_first_false_pos = this.m_stack_size;
		}
		++this.m_stack_size;
	}

	public pop_back(): void {
		if (this.m_stack_size <= 0) {
			throw 'pop_back: stack size <= 0';
		}
		--this.m_stack_size;
		if (this.m_first_false_pos == this.m_stack_size) {
			// When popping off the first false value, everything becomes true.
			this.m_first_false_pos = NO_FALSE;
		}
	}

	public toggle_top(): void {
		if (this.m_stack_size <= 0) {
			throw 'toggle_top: stack size <= 0';
		}
		if (this.m_first_false_pos === NO_FALSE) {
			// The current stack is all true values; the first false will be the top.
			this.m_first_false_pos = this.m_stack_size - 1;
		} else if (this.m_first_false_pos === this.m_stack_size - 1) {
			// The top is the first false value; toggling it will make everything true.
			this.m_first_false_pos = NO_FALSE;
		} // else {
		// There is a false value, but not on top. No action is needed as toggling
		// anything but the first false value is unobservable.
		// }
	}

	public clone(): ConditionStack {
		const cs = new ConditionStack();
		cs.m_stack_size = this.m_stack_size;
		cs.m_first_false_pos = this.m_first_false_pos;
		return cs;
	}
}
