#!/bin/bash

for i in $(seq 1 $2)
do
	echo "Running test $1 ($i/$2)"
	node "$1" || exit $!
done
