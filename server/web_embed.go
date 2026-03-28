package main

import "embed"

//go:embed resource/**
var webFS embed.FS
