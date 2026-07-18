//package com.comfy.library.repository;
//
//import com.comfy.library.entity.LoraImageEntity;
//import org.springframework.data.jpa.repository.JpaRepository;
//import org.springframework.stereotype.Repository;
//
//import java.util.List;
//import java.util.Optional;
//
//@Repository
//public interface LoraImageRepository extends JpaRepository<LoraImageEntity, Long> {
//
//    List<LoraImageEntity> findByLoraIdOrderByIdAsc(Long LoraId);
//
//    long countByLoraId(Long loraId);
//
//    Optional<LoraImageEntity> findByIdAndLoraId(
//            Long imageId,
//            Long loraId
//    );
//}
//
//
//
