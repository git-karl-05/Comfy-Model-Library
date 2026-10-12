//package com.comfy.library.controller;
//
//
//import com.comfy.library.dto.pose.CreatePoseRequest;
//import com.comfy.library.dto.pose.PoseResponse;
//import com.comfy.library.service.PoseService;
//import org.springframework.web.bind.annotation.*;
//
//@RestController
//@RequestMapping("/api/poses")
//public class PoseController {
//
//    private final PoseService poseService;
//
//    public PoseController(PoseService poseService) {
//        this.poseService = poseService;
//    }
//
//    @PostMapping
//    public PoseResponse createPose(@RequestBody CreatePoseRequest request) {
//        return poseService.createPose(request)
//    }
//}
